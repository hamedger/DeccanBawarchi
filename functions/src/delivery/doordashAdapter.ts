import {
  DeliveryDispatchResult,
  DeliveryProviderAdapter,
  DeliveryQuoteInput,
  DeliveryQuoteResult,
  DeliveryWebhookEvent,
} from './providerAdapter'
import { resolveDeliveryLocation } from './resolveDeliveryLocation'
import {
  DD_STATUS_MAP,
  buildDoorDashItems,
  buildDropoffAddressComponents,
  customerGivenName,
  doorDashRequest,
  formatDropoffAddress,
  etaMinutesFromDropoff,
  isValidUsPhone,
  logDoorDashFailure,
  normalizeUsPhone,
  readDoorDashError,
  userFacingDoorDashError,
} from './doordashShared'

async function getQuote(input: DeliveryQuoteInput): Promise<DeliveryQuoteResult> {
  const phone = normalizeUsPhone(input.dropoffPhoneNumber)
  if (phone && !isValidUsPhone(phone)) {
    throw new Error('Please enter a valid US phone number.')
  }

  const location = await resolveDeliveryLocation(input.locationId)
  const externalDeliveryId = `quote_${Date.now()}`

  const payload: Record<string, unknown> = {
    external_delivery_id: externalDeliveryId,
    pickup_address: location.pickupAddress,
    pickup_business_name: location.pickupBusinessName,
    pickup_phone_number: location.pickupPhone,
    dropoff_address: formatDropoffAddress(input),
    dropoff_address_components: buildDropoffAddressComponents(input),
    dropoff_contact_given_name: customerGivenName(input.dropoffContactGivenName),
    dropoff_phone_number: phone || '+12485550100',
    dropoff_contact_send_notifications: true,
    order_value: input.orderValue,
    pickup_time: input.pickupTime?.trim()
      ? input.pickupTime.trim()
      : new Date(Date.now() + location.prepBufferMinutes * 60_000).toISOString(),
  }

  if (input.items.length > 0) {
    payload.items = buildDoorDashItems(input.items)
  }

  let resp
  try {
    resp = await doorDashRequest('/drive/v2/quotes', { method: 'POST', body: payload })
  } catch {
    throw new Error('DoorDash quote network error')
  }

  if (!resp.ok) {
    const errorBody = await readDoorDashError(resp)
    logDoorDashFailure('DoorDash quote request failed', resp, errorBody)
    throw new Error(userFacingDoorDashError(resp.status, errorBody))
  }

  const result = (await resp.json()) as { fee?: number; dropoff_time_estimated?: string }

  return {
    feeCents: result.fee ?? 0,
    etaMinutes: etaMinutesFromDropoff(result.dropoff_time_estimated),
    externalQuoteId: externalDeliveryId,
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
    throw new Error('Customer phone number is required for DoorDash delivery.')
  }

  // Tip stays as restaurant revenue — do not forward the customer's tip to the dasher.
  const resp = await doorDashRequest(`/drive/v2/quotes/${encodeURIComponent(quoteId)}/accept`, {
    method: 'POST',
    body: { tip: 0, dropoff_phone_number: phone },
  })

  if (!resp.ok) {
    const errorBody = await readDoorDashError(resp)
    logDoorDashFailure('DoorDash accept quote failed', resp, errorBody)
    throw new Error(userFacingDoorDashError(resp.status, errorBody))
  }

  const result = (await resp.json()) as {
    external_delivery_id?: string
    tracking_url?: string
    support_reference?: string
  }

  return {
    externalId: String(result.external_delivery_id ?? quoteId),
    trackingUrl: result.tracking_url ?? '',
    supportId: result.support_reference != null ? String(result.support_reference) : undefined,
  }
}

async function cancel(externalId: string): Promise<void> {
  const resp = await doorDashRequest(`/drive/v2/deliveries/${encodeURIComponent(externalId)}/cancel`, {
    method: 'POST',
    body: {},
  })
  if (!resp.ok) {
    const errorBody = await readDoorDashError(resp)
    throw new Error(`DoorDash cancel failed (${resp.status}): ${errorBody}`)
  }
}

function mapWebhookEvent(payload: unknown): DeliveryWebhookEvent | null {
  const event = payload as {
    external_delivery_id?: string
    event_name?: string
    dasher_location?: { lat?: number; lng?: number }
    tracking_url?: string
    support_reference?: string | number
    dropoff_time_estimated?: string
  }

  const lookupKey = String(event.external_delivery_id ?? '').trim()
  if (!lookupKey) return null

  const ddStatus = String(event.event_name ?? '').trim()
  const status = DD_STATUS_MAP[ddStatus] ?? DD_STATUS_MAP[ddStatus.toUpperCase()]
  const lat = event.dasher_location?.lat
  const lng = event.dasher_location?.lng

  return {
    lookupKey,
    status,
    driverLocation: typeof lat === 'number' && typeof lng === 'number' ? { lat, lng } : undefined,
    trackingUrl: event.tracking_url,
    supportId: event.support_reference != null ? String(event.support_reference) : undefined,
    estimatedDeliveryIso: event.dropoff_time_estimated,
  }
}

export const doordashAdapter: DeliveryProviderAdapter = {
  id: 'doordash',
  getQuote,
  dispatch,
  cancel,
  mapWebhookEvent,
}
