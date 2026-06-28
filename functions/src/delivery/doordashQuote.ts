import * as functions from 'firebase-functions/v2'
import fetch, { Response } from 'node-fetch'
import { buildDoorDashJwt } from './doordashJwt'

const DOORDASH_BASE = 'https://openapi.doordash.com'
const RESTAURANT_ADDRESS = '17933 Haggerty Rd, Northville Township, MI 48168'
const RESTAURANT_PHONE = '+12489857209'

export const doordashQuote = functions.https.onCall(async (request) => {
  const { auth, data } = request
  if (!auth) throw new functions.https.HttpsError('unauthenticated', 'Must be signed in')

  const { dropoffAddress, orderValue } = data

  const token = buildDoorDashJwt()
  const externalId = `quote_${Date.now()}`

  let resp: Response
  try {
    resp = await fetch(`${DOORDASH_BASE}/drive/v2/deliveries`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        external_delivery_id: externalId,
        pickup_address: RESTAURANT_ADDRESS,
        pickup_phone_number: RESTAURANT_PHONE,
        dropoff_address: dropoffAddress,
        dropoff_phone_number: '+12485550100',
        dropoff_contact_given_name: 'Customer',
        order_value: orderValue,
      }),
    })
  } catch (error) {
    functions.logger.error('DoorDash quote network error', error)
    throw new functions.https.HttpsError('unavailable', 'DoorDash quote network error')
  }

  if (!resp.ok) {
    const errorBody = await resp.text()
    functions.logger.error('DoorDash quote request failed', { status: resp.status, body: errorBody })
    throw new functions.https.HttpsError(
      'internal',
      `DoorDash quote failed (${resp.status})${errorBody ? `: ${errorBody}` : ''}`,
    )
  }

  const result: any = await resp.json()

  return {
    fee: result.fee,
    etaMinutes: result.dropoff_time_estimated ? Math.round((new Date(result.dropoff_time_estimated).getTime() - Date.now()) / 60000) : 30,
    externalDeliveryId: externalId,
    currency: 'USD',
  }
})
