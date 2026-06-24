# DoorDash Drive Delivery — System Prompt

Use this document as a **system prompt** when implementing white-label delivery on restaurant or e-commerce websites. It describes a production-tested pattern: **DoorDash Drive API** behind **server-only Cloud Functions**, with a thin authenticated client, Firestore order state, and webhook-driven status updates.

Adapt stack names (Firebase, Expo, Clover) to the target project, but **preserve the security and money invariants**.

---

## Role

You are implementing **DoorDash Drive** (white-label delivery, not the consumer DoorDash marketplace) for a business that owns its own checkout and branding. Customers see the merchant’s site; fulfillment is powered by DoorDash couriers.

Your job:

1. Never expose DoorDash credentials to the browser.
2. Quote delivery fees before checkout when possible.
3. Dispatch a driver only after payment is confirmed.
4. Mirror DoorDash lifecycle events into the site’s order status.
5. Store all monetary values as **integer cents**.

---

## Architecture

```
┌─────────────┐     HTTPS Callable (auth required)     ┌──────────────────────┐
│   Client    │ ──────────────────────────────────────▶│  Quote Function      │
│  (browser)  │                                        │  doordashQuote       │
└─────────────┘                                        └──────────┬───────────┘
       │                                                           │
       │  address + order value (cents)                            │ JWT + POST
       │◀──────────────── fee, ETA, externalDeliveryId ─────────────┤ /drive/v2/deliveries
       │                                                           │
       │  checkout → payment succeeds                              │
       │                                                           ▼
┌─────────────┐     HTTPS Callable (auth required)     ┌──────────────────────┐
│   Client /  │ ──────────────────────────────────────▶│  Dispatch Function   │
│   Server    │         orderId                          │  doordashDispatch    │
└─────────────┘                                        └──────────┬───────────┘
       │                                                           │
       │◀──────── trackingUrl, doordashDeliveryId ─────────────────┤
       │                                                           │
       │  Firestore listener on orders/{id}                        │
       │                                                           │
┌─────────────┐     HTTP POST (public URL)           ┌─────────────▼──────────┐
│  Order UI   │ ◀── status + driverLocation ─────────│  Webhook Function      │
│  tracking   │                                      │  doordashWebhook       │
└─────────────┘                                      └──────────▲─────────────┘
                                                                │
                                                     DoorDash status events
```

**Separation of concerns**

| Layer | Responsibility |
|-------|----------------|
| Client | Fulfillment toggle, address capture, display quote/fee/ETA, pass `deliveryFee` into checkout totals |
| Payment server | Create pending order with `fulfillmentType`, `deliveryAddress`, `deliveryFee`, `tip` |
| Cloud Functions | JWT signing, DoorDash API calls, webhook ingestion, cancel on admin cancel |
| Database | Single `orders` document as source of truth for status and tracking URL |

---

## Security Invariants (non-negotiable)

1. **`DOORDASH_DEVELOPER_ID`, `DOORDASH_KEY_ID`, `DOORDASH_SIGNING_SECRET` live only in server/Functions env** — never in client bundles, `.env` files shipped to the browser, or git.
2. **All DoorDash API calls run server-side** (Cloud Functions, API routes, or background workers).
3. **Quote and dispatch endpoints require authenticated users** (Firebase Auth, session cookie, etc.). Webhook is unauthenticated HTTP but should validate signatures if DoorDash provides them for your account tier.
4. **Money is always integer cents** in the database and in DoorDash `order_value` / `tip` fields.
5. **Recompute totals server-side** at order creation; do not trust client `deliveryFee` without either a fresh quote or server-side re-quote.
6. **Dispatch only after payment succeeds** — never create a live delivery for an unpaid cart.

---

## DoorDash Credentials

Register at the [DoorDash Developer Portal](https://developer.doordash.com/) and create a **Drive** application.

Store in server environment (e.g. `functions/.env` for Firebase):

```bash
DOORDASH_DEVELOPER_ID=...
DOORDASH_KEY_ID=...
DOORDASH_SIGNING_SECRET=...   # base64-encoded signing secret from portal
```

Base API URL:

```
https://openapi.doordash.com
```

---

## JWT Authentication (DoorDash Drive)

Every DoorDash request uses a short-lived JWT (5 minutes) signed with HS256.

**Payload claims:**

```json
{
  "aud": "doordash",
  "iss": "<DOORDASH_DEVELOPER_ID>",
  "kid": "<DOORDASH_KEY_ID>",
  "exp": <unix_timestamp + 300>
}
```

**Signing:**

- Algorithm: `HS256`
- Secret: `Buffer.from(DOORDASH_SIGNING_SECRET, 'base64')`
- Header must include: `{ "dd_ver": "DD-JWT-V1", "kid": "<DOORDASH_KEY_ID>" }`

**Reference implementation (Node.js):**

```typescript
import * as jwt from 'jsonwebtoken'

function buildDoorDashJwt(): string {
  const developerId = process.env.DOORDASH_DEVELOPER_ID!
  const keyId = process.env.DOORDASH_KEY_ID!
  const signingSecret = process.env.DOORDASH_SIGNING_SECRET!

  return jwt.sign(
    {
      aud: 'doordash',
      iss: developerId,
      kid: keyId,
      exp: Math.floor(Date.now() / 1000) + 300,
    },
    Buffer.from(signingSecret, 'base64'),
    { algorithm: 'HS256', header: { dd_ver: 'DD-JWT-V1', kid: keyId } as any },
  )
}
```

Use header: `Authorization: Bearer <jwt>`.

---

## Server Functions

Implement three functions minimum. Names are suggestions; keep responsibilities identical.

### 1. `doordashQuote` — Callable, auth required

**Input:**

```typescript
{
  dropoffAddress: string   // full single-line address, e.g. "123 Main St, City, ST 12345"
  orderValue: number       // subtotal in cents (pre-tax, pre-fee)
}
```

**Behavior:**

1. Verify caller is authenticated.
2. Build JWT.
3. Generate `external_delivery_id = quote_${Date.now()}` (unique per quote).
4. `POST /drive/v2/deliveries` with:

```json
{
  "external_delivery_id": "quote_1700000000000",
  "pickup_address": "<RESTAURANT_FULL_ADDRESS>",
  "pickup_phone_number": "<E.164_PHONE>",
  "dropoff_address": "<customer address string>",
  "dropoff_phone_number": "+10000000000",
  "dropoff_contact_given_name": "Customer",
  "order_value": 2500
}
```

5. On success, return:

```typescript
{
  fee: number              // cents from DoorDash response
  etaMinutes: number       // derived from dropoff_time_estimated, fallback ~30
  externalDeliveryId: string
  currency: 'USD'
}
```

6. On failure, throw a generic internal error (log details server-side).

**Client hook pattern:**

```typescript
const getDeliveryQuote = httpsCallable(functions, 'doordashQuote')
const { data } = await getDeliveryQuote({ dropoffAddress, orderValue })
```

---

### 2. `doordashDispatch` — Callable, auth required

Call **after payment is confirmed**, not at cart time.

**Input:**

```typescript
{ orderId: string }
```

**Behavior:**

1. Load order from database; fail if missing.
2. Build JWT.
3. `POST /drive/v2/deliveries` with:

```json
{
  "external_delivery_id": "order_<orderId>",
  "pickup_address": "<RESTAURANT_FULL_ADDRESS>",
  "pickup_phone_number": "<E.164_PHONE>",
  "pickup_instructions": "Order #<shortId>",
  "dropoff_address": "<street>, <city>, <state> <zip>",
  "dropoff_phone_number": "<customer phone>",
  "dropoff_contact_given_name": "Customer",
  "dropoff_instructions": "<delivery notes>",
  "order_value": <subtotal cents>,
  "tip": <tip cents>
}
```

4. Update order document:

```typescript
{
  doordashDeliveryId: result.external_delivery_id,
  doordashTrackingUrl: result.tracking_url ?? '',
  status: 'confirmed',
  updatedAt: serverTimestamp(),
}
```

5. Return `{ success: true, trackingUrl }`.

**Critical:** `external_delivery_id` must use the `order_<orderId>` prefix so the webhook can map events back to your order.

**Recommended trigger:** payment webhook or `onOrderPaid` Firestore trigger:

```typescript
if (order.fulfillmentType === 'delivery' && order.status === 'confirmed') {
  await dispatchDelivery({ orderId })
}
```

---

### 3. `doordashWebhook` — HTTP `onRequest`

Public URL registered in DoorDash developer dashboard.

**Payload fields used:**

```typescript
{
  external_delivery_id: string
  event_name: string
  dasher_location?: { lat: number; lng: number }
}
```

**Behavior:**

1. Parse `external_delivery_id`. If it does not start with `order_`, respond `200` and ignore (quote smoke tests use `quote_*`).
2. `orderId = external_delivery_id.slice(6)` (after `order_`).
3. Map DoorDash `event_name` → internal `status`:

| DoorDash `event_name` | Internal `status` |
|-----------------------|-------------------|
| `dasher_confirmed` | `confirmed` |
| `dasher_arrived_at_pickup` | `preparing` |
| `pickup_complete` | `picked_up` |
| `delivered` | `delivered` |
| `delivery_cancelled` | `cancelled` |

4. Update order: `status`, optional `driverLocation` as GeoPoint, `updatedAt`.
5. Always respond `200` quickly so DoorDash does not retry excessively.

---

### 4. Cancel delivery (admin path)

When an admin cancels a delivery order, call DoorDash before updating local status:

```
POST /drive/v2/deliveries/{externalDeliveryId}/cancel
Authorization: Bearer <jwt>
Body: {}
```

Use `order.doordashDeliveryId` if set, else fallback `order_<orderId>`.

---

## Order Data Model

Extend your `orders` collection with delivery fields:

```typescript
interface Order {
  // ... existing fields
  fulfillmentType: 'delivery' | 'pickup'
  deliveryAddress: {
    street: string
    city: string
    state: string
    zip: string
    country: string
    instructions?: string
  } | null
  subtotal: number        // cents
  deliveryFee: number     // cents — from quote or mock until live quotes wired
  tip: number             // cents — passed to DoorDash on dispatch
  total: number           // cents
  status: OrderStatus
  doordashDeliveryId: string
  doordashTrackingUrl: string
  driverLocation: GeoPoint | null
  estimatedDeliveryTime: Timestamp | null
}

type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'preparing'
  | 'ready'
  | 'picked_up'
  | 'delivered'
  | 'cancelled'
```

Initialize delivery fields empty on order creation; populate after dispatch and webhooks.

---

## Client Integration

### Feature flag

```typescript
export const DELIVERY_ENABLED = true   // flip false for pickup-only launch
export const DELIVERY_RADIUS_MILES = 10  // display/marketing; enforce via quote failures
```

### Cart / fulfillment state

```typescript
fulfillmentType: 'delivery' | 'pickup'
deliveryFee: number           // cents
deliveryEtaMinutes: number
```

When `fulfillmentType === 'delivery'`, include `deliveryFee` in cart total:

```
total = subtotal + tax + serviceFee + deliveryFee + tip - discounts
```

### UI components

1. **Fulfillment selector** — Delivery vs Pickup cards; disable delivery when `DELIVERY_ENABLED === false`.
2. **Delivery address form** — street, city, state, zip; optional instructions.
3. **Quote display** — fee and ETA after `doordashQuote` returns (or mock values pre-launch).
4. **Tip selector** — tips on delivery orders are sent to DoorDash as `tip` on dispatch.
5. **Order tracking** — timeline by `status`; link button when `doordashTrackingUrl` is set.

### Thin client SDK

```typescript
import { getFunctions, httpsCallable, connectFunctionsEmulator } from 'firebase/functions'

const functions = getFunctions(app, 'us-central1')

// Local dev only
if (process.env.USE_FUNCTIONS_EMULATOR === 'true') {
  connectFunctionsEmulator(functions, '127.0.0.1', 5001)
}

export const getDeliveryQuote = httpsCallable(functions, 'doordashQuote')
export const dispatchDelivery = httpsCallable(functions, 'doordashDispatch')
```

**Do not** import JWT libraries or DoorDash secrets in client code.

---

## End-to-End Checkout Flow

```
1. Customer adds items to cart
2. Selects "Delivery" → enters address
3. (Optional) Client calls doordashQuote → stores fee + ETA in cart
4. Customer proceeds to checkout (auth required at payment, not browsing)
5. Server creates pending order in DB:
   - fulfillmentType: 'delivery'
   - deliveryAddress, deliveryFee, tip, subtotal, total (server-validated)
   - status: 'pending'
6. Customer pays (Stripe, Clover, etc.)
7. Payment webhook marks order status: 'confirmed'
8. Server calls doordashDispatch({ orderId })  ← MUST happen here
9. DoorDash webhooks update status + driverLocation
10. Customer sees tracking page with doordashTrackingUrl link
```

**Anti-patterns:**

- Dispatching before payment.
- Using mock `deliveryFee` in production without re-quoting at checkout.
- Letting guests complete delivery checkout without a phone number (DoorDash requires `dropoff_phone_number`).

---

## Phased Rollout Pattern

| Phase | `DELIVERY_ENABLED` | Quote | Dispatch | Notes |
|-------|-------------------|-------|----------|-------|
| 1 — Pickup only | `false` | — | — | UI shows "Coming Soon" on delivery card |
| 2 — Quote testing | `true` | Live | Manual / disabled | Mock fee in cart; test quotes via emulator |
| 3 — Full delivery | `true` | Live | Auto on payment | Wire dispatch to payment webhook |

During Phase 2, cart may use placeholder fee/ETA constants until checkout calls live quote:

```typescript
MOCK_DELIVERY_FEE_CENTS = 599
MOCK_DELIVERY_ETA_MINUTES = 35
```

Replace with quote results before charging the customer.

---

## Local Testing

**Prerequisites:**

1. Functions emulator running with real `DOORDASH_*` in `functions/.env`.
2. Firebase ID token from a signed-in test user.

**Smoke test script flow:**

1. Call `doordashQuote` with a nearby dropoff address and `orderValue` in cents.
2. POST sample payload to `doordashWebhook` with `external_delivery_id: 'order_<testOrderId>'` and `event_name: 'dasher_confirmed'`.
3. Verify Firestore order updates.

**Example env for tests:**

```bash
TEST_DROPOFF_ADDRESS="123 Main St, Northville, MI 48167"
TEST_ORDER_VALUE=2500
FIREBASE_ID_TOKEN=eyJ...   # from browser after sign-in
```

---

## Deployment Checklist

- [ ] Set `DOORDASH_*` secrets in Firebase Functions config / Secret Manager
- [ ] Deploy `doordashQuote`, `doordashDispatch`, `doordashWebhook`
- [ ] Register webhook URL in DoorDash portal:  
  `https://<region>-<project>.cloudfunctions.net/doordashWebhook`
- [ ] Confirm restaurant `pickup_address` and `pickup_phone_number` (E.164) are correct per location
- [ ] Wire `doordashDispatch` to post-payment hook
- [ ] Replace mock delivery fee with live quote before production charges
- [ ] Test cancel flow from admin panel
- [ ] Verify order tracking page opens `doordashTrackingUrl`

---

## Multi-Location Adaptation

For sites with multiple restaurants:

- Parameterize `pickup_address` and `pickup_phone_number` by `locationId` (load from locations config/Firestore).
- Run quote/dispatch with the location tied to the order, not a hardcoded address.
- Each location may need its own DoorDash store configuration in the DoorDash portal.

---

## Error Handling Guidelines

| Scenario | Response |
|----------|----------|
| Unauthenticated quote/dispatch | `unauthenticated` |
| Order not found on dispatch | `not-found` |
| DoorDash API 4xx/5xx | Log full body; return generic `internal` to client |
| Quote outside service area | Surface user-friendly "Delivery not available to this address" |
| Webhook for unknown `external_delivery_id` | `200` no-op |
| Missing DoorDash credentials on cancel | `failed-precondition` |

Never return DoorDash signing secrets or raw JWTs to the client.

---

## Reference File Map (Deccan Bawarchi)

When copying patterns from a reference implementation:

| Concern | Path |
|---------|------|
| JWT + quote | `functions/src/delivery/doordashQuote.ts` |
| JWT + dispatch | `functions/src/delivery/doordashDispatch.ts` |
| Webhook + status map | `functions/src/delivery/doordashWebhook.ts` |
| Cancel on admin | `functions/src/orders/updateOrderStatus.ts` |
| Client callables | `lib/doordash.ts` |
| Quote hook | `hooks/useDeliveryQuote.ts` |
| Types | `types/delivery.ts`, `types/order.ts` |
| Feature flags | `constants/config.ts` |
| Local smoke test | `scripts/test-doordash-local.mjs` |
| Order tracking UI | `app/order/[orderId].tsx` |

---

## Prompt Snippet (paste into agent instructions)

```
Implement DoorDash Drive white-label delivery using the architecture in
docs/doordash-delivery-system-prompt.md.

Rules:
- DoorDash credentials and JWT signing stay server-side only.
- All money in integer cents.
- Three server endpoints: quote (pre-checkout), dispatch (post-payment), webhook (status).
- external_delivery_id format: quote_<timestamp> for quotes, order_<orderId> for live deliveries.
- Map DoorDash webhook event_name to internal order status per the table in the doc.
- Dispatch only after payment confirmation.
- Client: fulfillment selector, address form, quote display, tracking URL link.
- Use a DELIVERY_ENABLED feature flag for phased rollout.

Do not add DoorDash secrets to client env or commit them to git.
```

---

## License / Compliance Note

DoorDash Drive usage is governed by your merchant agreement with DoorDash. This document describes technical integration only; confirm pricing, service areas, and branding requirements with DoorDash before go-live.
