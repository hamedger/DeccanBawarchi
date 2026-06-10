import * as functions from 'firebase-functions/v2'
import * as jwt from 'jsonwebtoken'
import fetch from 'node-fetch'

const DOORDASH_BASE = 'https://openapi.doordash.com'
const RESTAURANT_ADDRESS = '17933 Haggerty Rd, Northville Township, MI 48168'
const RESTAURANT_PHONE = '+12489168700'

function buildJwt(): string {
  const developerId = process.env.DOORDASH_DEVELOPER_ID!
  const keyId = process.env.DOORDASH_KEY_ID!
  const signingSecret = process.env.DOORDASH_SIGNING_SECRET!

  const header = { algorithm: 'HS256', header: { dd_ver: 'DD-JWT-V1', kid: keyId } }
  return jwt.sign(
    { aud: 'doordash', iss: developerId, kid: keyId, exp: Math.floor(Date.now() / 1000) + 300 },
    Buffer.from(signingSecret, 'base64'),
    { algorithm: 'HS256', header: { dd_ver: 'DD-JWT-V1', kid: keyId } as any },
  )
}

export const doordashQuote = functions.https.onCall(async (request) => {
  const { auth, data } = request
  if (!auth) throw new functions.https.HttpsError('unauthenticated', 'Must be signed in')

  const { dropoffAddress, orderValue } = data

  const token = buildJwt()
  const externalId = `quote_${Date.now()}`

  const resp = await fetch(`${DOORDASH_BASE}/drive/v2/deliveries`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      external_delivery_id: externalId,
      pickup_address: RESTAURANT_ADDRESS,
      pickup_phone_number: RESTAURANT_PHONE,
      dropoff_address: dropoffAddress,
      dropoff_phone_number: '+10000000000',
      dropoff_contact_given_name: 'Customer',
      order_value: orderValue,
    }),
  })

  if (!resp.ok) {
    throw new functions.https.HttpsError('internal', 'DoorDash quote failed')
  }

  const result: any = await resp.json()

  return {
    fee: result.fee,
    etaMinutes: result.dropoff_time_estimated ? Math.round((new Date(result.dropoff_time_estimated).getTime() - Date.now()) / 60000) : 30,
    externalDeliveryId: externalId,
    currency: 'USD',
  }
})
