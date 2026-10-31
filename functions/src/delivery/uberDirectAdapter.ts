import { getAccessToken, createDeliveriesClient } from 'uber-direct'
import {
  DeliveryDispatchResult,
  DeliveryProviderAdapter,
  DeliveryQuoteInput,
  DeliveryQuoteResult,
  DeliveryWebhookEvent,
} from './providerAdapter'
import { resolveDeliveryLocation, AddressComponents } from './resolveDeliveryLocation'
import { normalizeUsPhone, isValidUsPhone, customerGivenName } from './doordashShared'

// The published `uber-direct` SDK's request/response TypeScript types are broken in this
// version (they reference a types file missing from the npm package), so requests/responses
// are typed loosely here and verified against Uber's actual sandbox responses at test time
// rather than the compiler. Confirmed from Uber's docs/examples during planning:
//   - pickup_address / dropoff_address are JSON-STRINGS of address components, not objects.
//   - Quote response: { id, fee (cents), dropoff_eta, duration, expires, ... }.
//   - Webhooks: kind: 'event.delivery_status' (status changes) or 'event.courier_update'
//     (courier lat/lng, sent ~every 20s once a courier is assigned), both carrying a `data`
//     object with the full delivery record (including `id`).
// Re-verify exact field names against a real sandbox call before relying on this in production.

function stringifyAddress(components: AddressComponents): string {
  return JSON.stringify({
    street_address: [components.street],
    city: components.city,
    state: components.state,
    zip_code: components.zip,
    country: 'US',
  })
}

async function client() {
  const token = await getAccessToken()
  return createDeliveriesClient(token)
}

async function getQuote(input: DeliveryQuoteInput): Promise<DeliveryQuoteResult> {
  const phone = normalizeUsPhone(input.dropoffPhoneNumber)
  if (phone && !isValidUsPhone(phone)) {
    throw new Error('Please enter a valid US phone number.')
  }

  const location = await resolveDeliveryLocation(input.locationId)
  const deliveries = await client()

  const resp = (await deliveries.createQuote({
    pickup_address: stringifyAddress(location.pickupAddressComponents),
    dropoff_address: stringifyAddress({
      street: input.dropoffUnit?.trim()
        ? `${input.dropoffStreet.trim()}, ${input.dropoffUnit.trim()}`
        : input.dropoffStreet.trim(),
      city: input.dropoffCity,
      state: input.dropoffState,
      zip: input.dropoffZip,
    }),
    pickup_phone_number: location.pickupPhone,
    dropoff_phone_number: phone || '+12485550100',
    manifest_total_value: input.orderValue,
  })) as { fee?: number; id?: string; duration?: number }

  const externalQuoteId = String(resp.id ?? '').trim()
  if (!externalQuoteId) {
    throw new Error('Uber Direct did not return a quote id.')
  }

  return {
    feeCents: resp.fee ?? 0,
    etaMinutes: resp.duration ?? 35,
    externalQuoteId,
  }
}

async function dispatch(
  _orderId: string,
  order: Record<string, unknown>,
): Promise<DeliveryDispatchResult> {
  const quoteId = String(order.deliveryExternalQuoteId ?? '').trim()
  if (!quoteId) {
    throw new Error('Missing delivery quote. Customer must re-checkout.')
  }

  const phone = normalizeUsPhone(String(order.guestPhone ?? ''))
  if (!isValidUsPhone(phone)) {
    throw new Error('Customer phone number is required for delivery.')
  }

  const address = order.deliveryAddress as
    | { street?: string; city?: string; state?: string; zip?: string; unit?: string }
    | undefined
  if (!address?.street || !address.city || !address.zip) {
    throw new Error('Missing delivery address.')
  }

  const items = Array.isArray(order.items)
    ? (order.items as Array<{ name: string; quantity: number; price: number }>)
    : []
  const location = await resolveDeliveryLocation(String(order.locationId ?? ''))
  const deliveries = await client()

  const resp = (await deliveries.createDelivery({
    quote_id: quoteId,
    pickup_address: stringifyAddress(location.pickupAddressComponents),
    pickup_name: location.pickupBusinessName,
    pickup_phone_number: location.pickupPhone,
    dropoff_address: stringifyAddress({
      street: address.unit?.trim() ? `${address.street}, ${address.unit}` : address.street ?? '',
      city: address.city ?? '',
      state: address.state ?? '',
      zip: address.zip ?? '',
    }),
    dropoff_name: customerGivenName(String(order.guestName ?? 'Customer')),
    dropoff_phone_number: phone,
    // Tip stays as restaurant revenue — do not forward the customer's tip to the courier.
    tip: 0,
    manifest_items: items.map((item) => ({
      name: item.name,
      quantity: item.quantity,
      price: item.price,
    })),
  })) as { id?: string; tracking_url?: string }

  const externalId = String(resp.id ?? '').trim()
  if (!externalId) {
    throw new Error('Uber Direct did not return a delivery id.')
  }

  return {
    externalId,
    trackingUrl: resp.tracking_url ?? '',
  }
}

async function cancel(externalId: string): Promise<void> {
  const deliveries = await client()
  await deliveries.cancelDelivery(externalId)
}

function mapWebhookEvent(payload: unknown): DeliveryWebhookEvent | null {
  const event = payload as {
    kind?: string
    data?: {
      id?: string
      status?: string
      tracking_url?: string
      courier?: { location?: { lat?: number; lng?: number } }
      dropoff_eta?: string
    }
  }

  const lookupKey = String(event.data?.id ?? '').trim()
  if (!lookupKey) return null

  const lat = event.data?.courier?.location?.lat
  const lng = event.data?.courier?.location?.lng

  return {
    lookupKey,
    // Uber's own status vocabulary (pending/pickup/pickup_complete/dropoff/delivered/canceled)
    // — map to internal OrderStatus values once confirmed against real sandbox webhook payloads.
    status: mapUberStatus(event.data?.status),
    driverLocation: typeof lat === 'number' && typeof lng === 'number' ? { lat, lng } : undefined,
    trackingUrl: event.data?.tracking_url,
    estimatedDeliveryIso: event.data?.dropoff_eta,
  }
}

function mapUberStatus(status: string | undefined): string | undefined {
  switch (status) {
    case 'pickup':
      return 'confirmed'
    case 'pickup_complete':
      return 'picked_up'
    case 'dropoff':
      return 'picked_up'
    case 'delivered':
      return 'delivered'
    case 'canceled':
      return 'cancelled'
    default:
      return undefined
  }
}

export const uberDirectAdapter: DeliveryProviderAdapter = {
  id: 'uber_direct',
  getQuote,
  dispatch,
  cancel,
  mapWebhookEvent,
}
