# DoorDash Drive Delivery — System Prompt

Use this document as a **system prompt** when implementing white-label delivery on restaurant or e-commerce websites. It describes a production-tested pattern: **DoorDash Drive API v2 (quote → accept)** behind **server-only Cloud Functions**, with a thin authenticated client, Firestore order state, and webhook-driven status updates.

Adapt stack names (Firebase, Expo, Clover) to the target project, but **preserve the security and money invariants**.

---

## Role

You are implementing **DoorDash Drive** (white-label delivery, not the consumer DoorDash marketplace) for a business that owns its own checkout and branding. Customers see the merchant's site; fulfillment is powered by DoorDash couriers.

Your job:

1. Never expose DoorDash credentials to the browser.
2. Quote delivery fees before checkout using **`POST /drive/v2/quotes`**.
3. Store the quote ID on the order and **accept the quote** only after payment succeeds.
4. Mirror DoorDash lifecycle events into the site's order status via webhooks.
5. Store all monetary values as **integer cents**.

---

## Architecture (Drive v2 — Quote → Accept)

```
┌─────────────┐     HTTPS Callable (auth required)     ┌──────────────────────┐
│   Client    │ ──────────────────────────────────────▶│  Quote Function      │
│  (browser)  │  structured address + orderValue       │  doordashQuote       │
└─────────────┘  + phone + pickupTime + items           └──────────┬───────────┘
       │                                                           │
       │◀──── fee, ETA, externalDeliveryId (quote_* id) ───────────┤ POST /drive/v2/quotes
       │                                                           │
       │  cart stores externalDeliveryId                           │
       │  checkout → payment succeeds                              │
       │  order saved with doordashQuoteId = quote id="id"   │
       │                                                           ▼
┌─────────────┐  Firestore trigger: status → 'placed'   ┌──────────────────────┐
│   Server /  │ ──────────────────────────────────────▶│  Dispatch Function   │
│  Functions  │         orderId                          │  doordashDispatch    │
└─────────────┘                                        └──────────┬───────────┘
       │                                                           │
       │◀── trackingUrl, doordashDeliveryId, supportReference ─────┤ POST /drive/v2/quotes/{id}/accept
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

**Why quote → accept (not direct `/deliveries` create)?**

DoorDash Drive v2 separates **pricing** (quote) from **dispatch** (accept). The quote returns a fee and ETA without assigning a driver. Accepting the quote after payment creates the live delivery and returns the tracking URL. This matches checkout UX (show fee before pay) and avoids orphan deliveries for abandoned carts.

**Separation of concerns**

| Layer | Responsibility |
|-------|----------------|
| Client | Feature flag, structured address form, phone capture, live quote hook, store `externalDeliveryId` in cart, pass `doordashQuoteId` at checkout |
| Payment server | Validate phone + address + `doordashQuoteId` for delivery orders; create pending order with `deliveryFee`, `tip`, `doordashQuoteId` |
| Cloud Functions | JWT signing, quote/accept/cancel API calls, Firestore dispatch trigger, webhook ingestion |
| Database | Single `orders` document as source of truth for quote ID, delivery ID, tracking URL, status |

---

## Security Invariants (non-negotiable)

1. **`DOORDASH_DEVELOPER_ID`, `DOORDASH_KEY_ID`, `DOORDASH_SIGNING_SECRET` live only in server/Functions env** — never in client bundles, browser `.env`, or git.
2. **All DoorDash API calls run server-side** (Cloud Functions, API routes, or background workers).
3. **Quote and dispatch endpoints require authenticated users** (Firebase Auth, session cookie, etc.). Webhook is unauthenticated HTTP; validate signatures if DoorDash provides them for your account tier.
4. **Money is always integer cents** in the database and in DoorDash `order_value` / `tip` / item `price` fields.
5. **Recompute totals server-side** at order creation; do not trust client `deliveryFee` without a live quote ID tied to the same address/value.
6. **Accept quote only after payment succeeds** — never accept a live delivery for an unpaid cart.
7. **Require `doordashQuoteId` on delivery orders** at server checkout validation so customers cannot bypass quoting.

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

**Sandbox vs production:** Use sandbox credentials for development. Production credentials require DoorDash merchant approval. Do not enable `EXPO_PUBLIC_DELIVERY_ENABLED=true` on production hosting until production credentials and webhook are registered and tested.

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
- Header must include: `{ "dd-ver": "DD-JWT-V1" }` (hyphen, not underscore)

**Shared request helper pattern:**

```typescript
export async function doorDashRequest(path: string, init: { method: string; body?: unknown }) {
  const token = buildDoorDashJwt()
  return fetch(`${DOORDASH_BASE}${path}`, {
    method: init.method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: init.body != null ? JSON.stringify(init.body) : undefined,
  })
}
```

Centralize JWT, phone normalization, address formatting, status maps, and user-facing error translation in a shared module (e.g. `doordashShared.ts`).

---

## Server Functions

Implement four functions minimum. Names are suggestions; keep responsibilities identical.

### 1. `doordashQuote` — Callable, auth required

**Purpose:** Get delivery fee and ETA without dispatching a driver.

**Input (prefer structured fields; legacy single-line supported):**

```typescript
{
  // Structured (preferred)
  dropoffStreet: string
  dropoffCity: string
  dropoffState?: string      // default 'MI' or your state
  dropoffZip: string
  dropoffCountry?: string    // default 'US'
  dropoffUnit?: string       // apt/suite → sub_premise

  // Legacy compat — send BOTH from client during rollout
  dropoffAddress?: string    // "123 Main St, City, ST 12345"

  orderValue: number          // subtotal in cents (pre-tax, pre-fee)
  dropoffPhoneNumber?: string // E.164 preferred; validated if present
  dropoffContactGivenName?: string
  pickupTime?: string         // ISO 8601; defaults to now + prep buffer
  locationId?: string         // multi-location pickup
  items?: Array<{ name: string; quantity: number; price: number }>
}
```

**Behavior:**

1. Verify caller is authenticated.
2. Accept address from structured fields **or** legacy `dropoffAddress` (at least one required).
3. Resolve pickup location from `locationId` (address, phone, business name, prep buffer, timezone).
4. Generate `external_delivery_id = quote_${Date.now()}` (unique per quote).
5. `POST /drive/v2/quotes` with:

```json
{
  "external_delivery_id": "quote_1700000000000",
  "pickup_address": "<LOCATION_PICKUP_ADDRESS>",
  "pickup_business_name": "<RESTAURANT_NAME>",
  "pickup_phone_number": "<E.164_PICKUP_PHONE>",
  "pickup_time": "2026-06-30T18:30:00.000Z",
  "dropoff_address": "123 Main St, Northville, MI 48167",
  "dropoff_address_components": {
    "street_address": "123 Main St",
    "city": "Northville",
    "state": "MI",
    "zip_code": "48167",
    "country": "US",
    "sub_premise": "Apt 2"
  },
  "dropoff_phone_number": "+12485550100",
  "dropoff_contact_given_name": "Customer",
  "dropoff_contact_send_notifications": true,
  "order_value": 2500,
  "items": [{ "name": "Biryani", "quantity": 2, "price": 1250 }]
}
```

6. On success, return:

```typescript
{
  fee: number              // cents from DoorDash response
  etaMinutes: number       // derived from dropoff_time_estimated
  externalDeliveryId: string  // the quote_* id — store on order as doordashQuoteId
  currency: 'USD'
}
```

7. On failure, map DoorDash errors to user-friendly messages (service area, phone, address, duplicate quote) and throw `failed-precondition`.

**Client hook pattern:**

```typescript
const result = await getDeliveryQuote({
  dropoffAddress: formatDropoffAddress(addr),  // legacy compat
  dropoffStreet: addr.street,
  dropoffCity: addr.city,
  dropoffState: addr.state,
  dropoffZip: addr.zip,
  dropoffUnit: addr.unit,
  orderValue: subtotalCents,
  dropoffPhoneNumber: phone,
  dropoffContactGivenName: firstName,
  pickupTime: pickupTimeIso,
  items: cartItems.map(i => ({ name: i.name, quantity: i.quantity, price: i.price })),
})
// cart.externalDeliveryId = result.externalDeliveryId
```

**Quote refresh:** Re-quote when address, subtotal, items, or pickup time changes. Refresh every ~5 minutes (quotes expire). Debounce address input (~600 ms).

---

### 2. `doordashDispatch` — Callable + Firestore trigger

**Purpose:** Accept the quoted delivery after payment. Does **not** create a new delivery from scratch.

**Input:**

```typescript
{ orderId: string }
```

**Behavior:**

1. Load order; fail if missing or not `fulfillmentType === 'delivery'`.
2. **Idempotency:** If `doordashDeliveryId` and `doordashTrackingUrl` already set, return success immediately.
3. Require `order.doordashQuoteId` (the `quote_*` external ID from checkout). Without it, throw `failed-precondition` — customer must re-checkout.
4. Require valid US E.164 customer phone (`+1XXXXXXXXXX`) from `guestPhone` / profile.
5. `POST /drive/v2/quotes/{doordashQuoteId}/accept` with:

```json
{
  "tip": 500,
  "dropoff_phone_number": "+12485550100"
}
```

6. Update order document (do **not** force `status: 'confirmed'` here — webhook sets that):

```typescript
{
  doordashDeliveryId: result.external_delivery_id,
  doordashTrackingUrl: result.tracking_url ?? '',
  doordashSupportId: result.support_reference,       // optional
  estimatedDeliveryTime: parseDropoffEstimated(...), // optional
  doordashDispatchError: FieldValue.delete(),
  updatedAt: serverTimestamp(),
}
```

7. Return `{ success: true, trackingUrl, supportReference }`.

**Recommended trigger:** Firestore `onDocumentUpdated` when order transitions to paid:

```typescript
// Dispatch when payment confirms — status becomes 'placed' (Clover) or 'confirmed' (Stripe)
const becamePlaced = before?.status !== 'placed' && after.status === 'placed'
const isDelivery = after.fulfillmentType === 'delivery'
const hasDelivery = Boolean(after.doordashDeliveryId?.trim())

if (becamePlaced && isDelivery && !hasDelivery) {
  try {
    await dispatchOrderToDoorDash(orderId)
  } catch (error) {
    await orderRef.update({ doordashDispatchError: error.message })
  }
}
```

On dispatch failure, persist `doordashDispatchError` on the order so staff can retry manually.

---

### 3. `doordashWebhook` — HTTP `onRequest`

Public URL registered in DoorDash developer dashboard (Cloud Run or Cloud Functions URL).

**Payload fields used:**

```typescript
{
  external_delivery_id: string
  event_name: string
  dasher_location?: { lat: number; lng: number }
  tracking_url?: string
  support_reference?: string | number
  dropoff_time_estimated?: string
}
```

**Order lookup (in priority order):**

1. `external_delivery_id` starts with `order_` → `orderId = slice(6)` (legacy pattern).
2. Query `orders` where `doordashQuoteId == external_delivery_id`.
3. Query `orders` where `doordashDeliveryId == external_delivery_id`.
4. If no match → respond `200` and ignore.

**Status mapping** — Drive v2 uses UPPERCASE; simulator/classic may use snake_case. Map both:

| DoorDash `event_name` | Internal `status` |
|-----------------------|-------------------|
| `DASHER_CONFIRMED` / `dasher_confirmed` / `dasher_enroute_to_pickup` | `confirmed` |
| `DASHER_CONFIRMED_PICKUP_ARRIVAL` / `dasher_confirmed_pickup_arrival` / `dasher_arrived_at_pickup` | `preparing` |
| `DASHER_PICKED_UP` / `dasher_picked_up` / `pickup_complete` / `dasher_enroute_to_dropoff` / `DASHER_CONFIRMED_DROPOFF_ARRIVAL` | `picked_up` |
| `DASHER_DROPPED_OFF` / `dasher_dropped_off` / `delivered` | `delivered` |
| `DELIVERY_CANCELLED` / `delivery_cancelled` | `cancelled` |

**Update order:** `status` (if mapped), `driverLocation` GeoPoint, `doordashTrackingUrl`, `doordashSupportId`, `estimatedDeliveryTime`, `updatedAt`.

Always respond `200` quickly so DoorDash does not retry excessively.

---

### 4. Cancel delivery (admin / customer cancel path)

When cancelling a delivery order, call DoorDash before updating local status:

```
POST /drive/v2/deliveries/{externalDeliveryId}/cancel
Authorization: Bearer <jwt>
Body: {}
```

Use `order.doordashDeliveryId` if set; else fallback to `order.doordashQuoteId` (pre-accept cancel). Log and proceed with local cancel if DoorDash cancel fails (delivery may already be complete).

---

## Order Data Model

Extend your `orders` collection with delivery fields:

```typescript
interface Order {
  // ... existing fields
  fulfillmentType: 'delivery' | 'pickup'
  locationId: string
  deliveryAddress: {
    street: string
    city: string
    state: string
    zip: string
    country: string
    unit?: string
    instructions?: string
  } | null
  subtotal: number        // cents
  deliveryFee: number     // cents — from live quote
  tip: number             // cents — sent to DoorDash on accept
  total: number           // cents
  status: OrderStatus
  guestPhone: string      // required for delivery; E.164

  // DoorDash lifecycle
  doordashQuoteId: string       // quote_* id from doordashQuote — set at order creation
  doordashDeliveryId: string    // set after accept
  doordashTrackingUrl: string   // set after accept; may update via webhook
  doordashSupportId?: string    // DoorDash support reference
  doordashDispatchError?: string // set if accept fails
  driverLocation: GeoPoint | null
  estimatedDeliveryTime: Timestamp | null
}

type OrderStatus =
  | 'pending'      // awaiting payment
  | 'placed'       // payment confirmed (triggers dispatch)
  | 'confirmed'    // dasher assigned (webhook)
  | 'preparing'    // dasher at pickup
  | 'ready'        // restaurant ready (optional internal state)
  | 'picked_up'    // en route / at dropoff
  | 'delivered'
  | 'cancelled'
```

**Field lifecycle:**

| Stage | Fields populated |
|-------|------------------|
| Quote (cart) | Client stores `externalDeliveryId` in cart state |
| Order creation | `doordashQuoteId`, `deliveryFee`, `deliveryAddress`, `guestPhone` |
| Payment → `placed` | Firestore trigger calls dispatch |
| Accept success | `doordashDeliveryId`, `doordashTrackingUrl`, `doordashSupportId` |
| Webhooks | `status`, `driverLocation`, ETA updates |

---

## Client Integration

### Feature flag

```typescript
// constants/config.ts — off by default in production builds
export const DELIVERY_ENABLED = process.env.EXPO_PUBLIC_DELIVERY_ENABLED === 'true'
```

Set `EXPO_PUBLIC_DELIVERY_ENABLED=true` in local `.env` only during sandbox testing. Keep `false` on production hosting until DoorDash production approval.

### Cart / fulfillment state

```typescript
fulfillmentType: 'delivery' | 'pickup'
deliveryFee: number              // cents — from quote
deliveryEtaMinutes: number
externalDeliveryId: string | null // quote_* id → becomes doordashQuoteId at checkout
```

When `fulfillmentType === 'delivery'`, include `deliveryFee` in cart total:

```
total = subtotal + tax + serviceFee + deliveryFee + tip - discounts
```

### UI components

1. **Fulfillment selector** — Delivery vs Pickup; disable delivery when `DELIVERY_ENABLED === false`.
2. **Structured delivery address form** — street, city, state, zip, unit; optional instructions.
3. **Phone field** — required for delivery; validate 10-digit US before checkout.
4. **Live quote display** — fee and ETA from `useLiveDeliveryQuote`; show loading/error states.
5. **Checkout gating** — block pay until quote succeeds (`externalDeliveryId` set, no quote error).
6. **Tip selector** — tips on delivery orders are sent as `tip` on quote accept.
7. **Order tracking** — timeline by `status`; link button when `doordashTrackingUrl` is set.

### Live quote hook

```typescript
useLiveDeliveryQuote({
  enabled: isDelivery && DELIVERY_ENABLED,
  dropoffAddress,
  orderValue: subtotalCents,
  items: cartItems,
  dropoffPhoneNumber: phone,
  dropoffContactGivenName: firstName,
  pickupTimeIso,
  onQuote: (quote) => cart.setDeliveryQuote(quote),
  onClear: () => cart.clearDeliveryQuote(),
})
// Debounce 600ms; auto-refresh every 5 minutes
```

### Thin client SDK

```typescript
import { getFunctions, httpsCallable, connectFunctionsEmulator } from 'firebase/functions'

const functions = getFunctions(app, 'us-central1')

if (process.env.EXPO_PUBLIC_USE_FUNCTIONS_EMULATOR === 'true') {
  connectFunctionsEmulator(functions, '127.0.0.1', 5001)
}

export const getDeliveryQuote = httpsCallable(functions, 'doordashQuote')
export const dispatchDelivery = httpsCallable(functions, 'doordashDispatch')
```

**Do not** import JWT libraries or DoorDash secrets in client code.

### Checkout payload (server)

Pass quote ID from cart to payment server:

```typescript
{
  fulfillmentType: 'delivery',
  deliveryAddress: { street, city, state, zip, unit, instructions },
  deliveryFee: cart.deliveryFee,
  doordashQuoteId: cart.externalDeliveryId,  // required
  customerPhone: e164Phone,
  tip: cart.tip,
  // ... totals validated server-side
}
```

---

## End-to-End Checkout Flow

```
1. Customer adds items to cart
2. Selects "Delivery" → enters structured address + phone
3. Client calls doordashQuote (debounced) → stores fee, ETA, externalDeliveryId in cart
4. Customer proceeds to checkout (auth required at payment, not browsing)
5. Server validates delivery order:
   - complete address, valid phone, doordashQuoteId present
   - totals match server-side calculation
6. Server creates pending order:
   - doordashQuoteId = cart.externalDeliveryId
   - deliveryFee, tip, deliveryAddress, status: 'pending'
7. Customer pays (Stripe, Clover, etc.)
8. Payment webhook / confirm → status: 'placed'
9. Firestore trigger calls doordashDispatch → POST quotes/{doordashQuoteId}/accept
10. Order updated with doordashDeliveryId + doordashTrackingUrl
11. DoorDash webhooks update status (confirmed → preparing → picked_up → delivered)
12. Customer sees tracking page with doordashTrackingUrl link
```

**Anti-patterns:**

- Accepting quote (dispatch) before payment.
- Creating deliveries via `POST /drive/v2/deliveries` for quote or dispatch (use v2 quotes API).
- Sending only structured address fields without legacy `dropoffAddress` during server/client version mismatch.
- Letting guests complete delivery checkout without a phone number.
- Setting `status: 'confirmed'` in dispatch — let the webhook do it when dasher is assigned.
- Using mock `deliveryFee` in production without a live quote ID.

---

## Phased Rollout Pattern

| Phase | `EXPO_PUBLIC_DELIVERY_ENABLED` | Quote | Accept/Dispatch | Notes |
|-------|-------------------------------|-------|-----------------|-------|
| 1 — Pickup only | `false` | — | — | UI shows "Coming Soon" on delivery card |
| 2 — Sandbox testing | `true` (local `.env` only) | Live sandbox | Auto on `placed` | Sandbox credentials in `functions/.env`; do NOT deploy flag to production hosting |
| 3 — Production | `true` (after approval) | Live prod | Auto on `placed` | Swap prod `DOORDASH_*`, register prod webhook, one test delivery, then enable hosting flag |

**Production go-live checklist after DoorDash approval:**

1. Replace sandbox `DOORDASH_*` in Firebase Functions secrets / `functions/.env`.
2. Redeploy functions (`doordashQuote`, `doordashDispatch`, `doordashWebhook`, dispatch trigger).
3. Register production webhook URL in DoorDash portal.
4. Run one real test delivery end-to-end.
5. Set `EXPO_PUBLIC_DELIVERY_ENABLED=true` and deploy web hosting.

---

## Local Testing

**Prerequisites:**

1. Real `DOORDASH_*` sandbox credentials in `functions/.env`.
2. Emulators running: `npm run functions:serve:doordash` (functions + auth + firestore).
3. Client `.env`:

```bash
EXPO_PUBLIC_USE_FUNCTIONS_EMULATOR=true
EXPO_PUBLIC_DELIVERY_ENABLED=true
EXPO_PUBLIC_USE_FIRESTORE_EMULATOR=true   # for dispatch E2E
EXPO_PUBLIC_USE_AUTH_EMULATOR=true        # auto when functions emulator on
```

**Test scripts:**

| Script | Purpose |
|--------|---------|
| `npm run test:doordash-local` | Smoke-test quote via emulator + auth |
| `npm run test:doordash-dispatch-e2e` | Full flow: create order → dispatch accept → webhook status |
| `npm run screenshot:doordash-ui` | Playwright browser screenshots of checkout quote UI |

**Quote test env vars:**

```bash
TEST_DROPOFF_STREET="123 Main St"
TEST_DROPOFF_CITY="Northville"
TEST_DROPOFF_ZIP="48167"
TEST_ORDER_VALUE=2500
TEST_DROPOFF_PHONE="+12485550100"
AUTH_EMULATOR_EMAIL=test@deccan.local
AUTH_EMULATOR_PASSWORD=testpass123
```

**Manual webhook test:**

```bash
curl -X POST https://<your-doordashWebhook-url> \
  -H "Content-Type: application/json" \
  -d '{"external_delivery_id":"<doordashQuoteId>","event_name":"DASHER_CONFIRMED"}'
```

Verify Firestore order `status` updates to `confirmed`.

---

## Multi-Location Adaptation

For sites with multiple restaurants:

- Maintain a locations config (`restaurantLocations.ts`) with per-location:
  - `pickupAddress`, `pickupPhone` (E.164), `pickup_business_name`, `prepBufferMinutes`, `timezone`
- Pass `locationId` on quote requests; resolve pickup fields server-side.
- Store `locationId` on the order; never hardcode a single restaurant address in quote/dispatch.
- Each location may need its own DoorDash store configuration in the DoorDash portal.

**Default pickup time when not scheduled:**

```typescript
pickup_time = pickupTimeIso ?? new Date(Date.now() + prepBufferMinutes * 60_000).toISOString()
```

Use the location's timezone (`America/Detroit`, etc.) when computing scheduled pickup slots client-side.

---

## Error Handling Guidelines

| Scenario | Response |
|----------|----------|
| Unauthenticated quote/dispatch | `unauthenticated` |
| Order not found on dispatch | `not-found` |
| Missing `doordashQuoteId` on dispatch | `failed-precondition` — "Customer must re-checkout" |
| Invalid/missing customer phone | `failed-precondition` |
| DoorDash API 4xx/5xx | Log full body; return user-facing message via `userFacingDoorDashError()` |
| Quote outside service area | "Delivery is not available to this address…" |
| Duplicate/expired quote | "Delivery quote expired. Please wait a moment and try again." |
| Webhook for unknown `external_delivery_id` | `200` no-op |
| Dispatch failure | Persist `doordashDispatchError` on order; do not block payment |
| Missing DoorDash credentials on cancel | `failed-precondition` |

Never return DoorDash signing secrets or raw JWTs to the client.

---

## Common Pitfalls

| Pitfall | Fix |
|---------|-----|
| Quote 400 "dropoffAddress required" | Client sends **both** structured fields and legacy `dropoffAddress` string; server accepts either |
| Checkout shows quote error after deploy | Client and Functions versions mismatched — redeploy functions after quote API changes |
| Dispatch fails "Missing DoorDash quote" | `doordashQuoteId` not passed from cart → checkout → order creation |
| Status stuck at `placed` after dispatch | Expected until webhook `DASHER_CONFIRMED`; don't set `confirmed` in dispatch |
| Quote stale at payment | Refresh quote every 5 min; re-quote if address/subtotal changes |
| Phone rejected by DoorDash | Normalize to E.164 `+1XXXXXXXXXX`; validate before checkout |
| Emulator auth failures | Start `functions:serve:doordash` (includes auth emulator on 9099) |
| Full page reload loses cart in tests | Use sessionStorage seed helpers or complete flow without reload |

---

## Deployment Checklist

- [ ] Set `DOORDASH_*` secrets in Firebase Functions config / Secret Manager
- [ ] Deploy `doordashQuote`, `doordashDispatch`, `doordashWebhook`, `onOrderConfirmedDispatch`
- [ ] Register webhook URL in DoorDash portal (note Cloud Run URL if using v2 functions)
- [ ] Confirm per-location `pickup_address`, `pickup_phone_number`, `pickup_business_name`
- [ ] Server checkout validates `doordashQuoteId` + phone for delivery orders
- [ ] Firestore trigger dispatches on `status === 'placed'` (or your paid status)
- [ ] `EXPO_PUBLIC_DELIVERY_ENABLED=false` on production until DoorDash prod approval
- [ ] Test quote → checkout → accept → webhook flow in sandbox
- [ ] Test cancel flow (uses `doordashDeliveryId` or `doordashQuoteId`)
- [ ] Verify order tracking page opens `doordashTrackingUrl`

---

## Reference File Map (Deccan Bawarchi)

When copying patterns from a reference implementation:

| Concern | Path |
|---------|------|
| JWT signing | `functions/src/delivery/doordashJwt.ts` |
| Shared helpers + status map | `functions/src/delivery/doordashShared.ts` |
| Quote (`POST /drive/v2/quotes`) | `functions/src/delivery/doordashQuote.ts` |
| Accept dispatch | `functions/src/delivery/doordashDispatch.ts` |
| Firestore dispatch trigger | `functions/src/delivery/onOrderConfirmedDispatch.ts` |
| Webhook + order lookup | `functions/src/delivery/doordashWebhook.ts` |
| Multi-location pickup | `functions/src/delivery/restaurantLocations.ts` |
| Cancel on admin/user cancel | `functions/src/orders/updateOrderStatus.ts` |
| Client callables | `lib/doordash.ts` |
| Live quote hook | `hooks/useLiveDeliveryQuote.ts` |
| Address/phone/pickup helpers | `lib/deliveryUtils.ts` |
| Cart quote state | `store/cartStore.ts` |
| Checkout gating + quote pass-through | `app/checkout/index.tsx` |
| Server order validation | `server/src/services/orderService.ts` |
| Types | `types/delivery.ts`, `types/order.ts` |
| Feature flag | `constants/config.ts` |
| Local quote smoke test | `scripts/test-doordash-local.mjs` |
| Dispatch + webhook E2E | `scripts/test-doordash-dispatch-e2e.mjs` |
| Browser UI screenshots | `scripts/screenshot-doordash-ui.mjs` |
| Evidence screenshots | `docs/screenshots/doordash/` |

---

## Prompt Snippet (paste into agent instructions)

```
Implement DoorDash Drive white-label delivery using the architecture in
docs/doordash-delivery-system-prompt.md.

Rules:
- DoorDash credentials and JWT signing stay server-side only.
- All money in integer cents.
- Use Drive v2 quote → accept flow:
  - Quote: POST /drive/v2/quotes → store externalDeliveryId as doordashQuoteId on order
  - Dispatch: POST /drive/v2/quotes/{doordashQuoteId}/accept after payment (not POST /deliveries)
- Send structured dropoff fields (street/city/state/zip/unit) AND legacy dropoffAddress for compat.
- Include pickup_time, pickup_business_name, location-aware pickup address/phone, optional items.
- Require valid US E.164 phone for delivery checkout and accept.
- Server must reject delivery orders without doordashQuoteId.
- Firestore trigger dispatches when order status becomes 'placed'; do not set confirmed in dispatch.
- Webhook maps Drive v2 UPPERCASE and snake_case event_name to internal status; lookup by doordashQuoteId or doordashDeliveryId.
- Client: EXPO_PUBLIC_DELIVERY_ENABLED feature flag, structured address form, useLiveDeliveryQuote hook,
  checkout gating on externalDeliveryId, pass doordashQuoteId to payment server.
- Persist doordashDispatchError on accept failure.
- Cancel via POST /drive/v2/deliveries/{id}/cancel using doordashDeliveryId or doordashQuoteId.

Do not add DoorDash secrets to client env or commit them to git.
Do not enable EXPO_PUBLIC_DELIVERY_ENABLED on production hosting until DoorDash production credentials are approved.
```

---

## License / Compliance Note

DoorDash Drive usage is governed by your merchant agreement with DoorDash. This document describes technical integration only; confirm pricing, service areas, and branding requirements with DoorDash before go-live.
