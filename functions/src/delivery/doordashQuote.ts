import * as functions from 'firebase-functions/v2'
import {
  buildDoorDashItems,
  buildDropoffAddressComponents,
  customerGivenName,
  doorDashRequest,
  etaMinutesFromDropoff,
  formatDropoffAddress,
  isValidUsPhone,
  logDoorDashFailure,
  normalizeUsPhone,
  readDoorDashError,
  userFacingDoorDashError,
  type DoorDashItemInput,
  type DropoffAddressInput,
} from './doordashShared'
import { resolveRestaurantLocation } from './restaurantLocations'

export const doordashQuote = functions.https.onCall(async (request) => {
  const { auth, data } = request
  if (!auth) throw new functions.https.HttpsError('unauthenticated', 'Must be signed in')

  const {
    dropoffAddress: legacyDropoffAddress,
    dropoffStreet,
    dropoffCity,
    dropoffState = 'MI',
    dropoffZip,
    dropoffCountry = 'US',
    dropoffUnit = '',
    orderValue,
    dropoffPhoneNumber = '',
    dropoffContactGivenName = 'Customer',
    pickupTime,
    locationId,
    items = [],
  } = data as {
    dropoffAddress?: string
    dropoffStreet?: string
    dropoffCity?: string
    dropoffState?: string
    dropoffZip?: string
    dropoffCountry?: string
    dropoffUnit?: string
    orderValue?: number
    dropoffPhoneNumber?: string
    dropoffContactGivenName?: string
    pickupTime?: string
    locationId?: string
    items?: DoorDashItemInput[]
  }

  const addressInput: DropoffAddressInput = {
    street: String(dropoffStreet ?? '').trim(),
    city: String(dropoffCity ?? '').trim(),
    state: String(dropoffState ?? 'MI').trim(),
    zip: String(dropoffZip ?? '').trim(),
    country: String(dropoffCountry ?? 'US').trim(),
    unit: String(dropoffUnit ?? '').trim() || undefined,
  }

  const legacyAddress = String(legacyDropoffAddress ?? '').trim()
  const hasStructuredAddress =
    Boolean(addressInput.street) && Boolean(addressInput.city) && Boolean(addressInput.zip)

  if (!hasStructuredAddress && !legacyAddress) {
    throw new functions.https.HttpsError('invalid-argument', 'Complete delivery address is required')
  }
  if (!orderValue || orderValue <= 0) {
    throw new functions.https.HttpsError('invalid-argument', 'orderValue must be positive')
  }

  const phone = normalizeUsPhone(String(dropoffPhoneNumber))
  if (phone && !isValidUsPhone(phone)) {
    throw new functions.https.HttpsError('invalid-argument', 'Please enter a valid US phone number.')
  }

  const location = resolveRestaurantLocation(locationId)
  const externalId = `quote_${Date.now()}`
  const dropoffAddress = hasStructuredAddress
    ? formatDropoffAddress(addressInput)
    : legacyAddress
  const givenName = customerGivenName(String(dropoffContactGivenName))

  const payload: Record<string, unknown> = {
    external_delivery_id: externalId,
    pickup_address: location.pickupAddress,
    pickup_business_name: location.name,
    pickup_phone_number: location.pickupPhone,
    dropoff_address: dropoffAddress,
    dropoff_contact_given_name: givenName,
    dropoff_phone_number: phone || '+12485550100',
    order_value: orderValue,
    dropoff_contact_send_notifications: true,
  }

  if (hasStructuredAddress) {
    payload.dropoff_address_components = buildDropoffAddressComponents(addressInput)
  }

  const orderItems = Array.isArray(items) ? items : []
  if (orderItems.length > 0) {
    payload.items = buildDoorDashItems(orderItems)
  }

  const pickupTimeIso = String(pickupTime ?? '').trim()
  payload.pickup_time = pickupTimeIso
    ? pickupTimeIso
    : new Date(Date.now() + location.prepBufferMinutes * 60_000).toISOString()

  let resp
  try {
    resp = await doorDashRequest('/drive/v2/quotes', { method: 'POST', body: payload })
  } catch (error) {
    functions.logger.error('DoorDash quote network error', error)
    throw new functions.https.HttpsError('unavailable', 'DoorDash quote network error')
  }

  if (!resp.ok) {
    const errorBody = await readDoorDashError(resp)
    logDoorDashFailure('DoorDash quote request failed', resp, errorBody)
    throw new functions.https.HttpsError(
      'failed-precondition',
      userFacingDoorDashError(resp.status, errorBody),
    )
  }

  const result = (await resp.json()) as {
    fee?: number
    dropoff_time_estimated?: string
  }

  return {
    fee: result.fee ?? 0,
    etaMinutes: etaMinutesFromDropoff(result.dropoff_time_estimated),
    externalDeliveryId: externalId,
    currency: 'USD',
  }
})
