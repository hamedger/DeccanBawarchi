import * as functions from 'firebase-functions/v2'
import * as admin from 'firebase-admin'
import * as jwt from 'jsonwebtoken'
import fetch from 'node-fetch'

if (!admin.apps.length) admin.initializeApp()

const db = admin.firestore()
const DOORDASH_BASE = 'https://openapi.doordash.com'
const RESTAURANT_ADDRESS = '17933 Haggerty Rd, Northville Township, MI 48168'
const RESTAURANT_PHONE = '+12489857209'

function buildJwt(): string {
  const developerId = process.env.DOORDASH_DEVELOPER_ID!
  const keyId = process.env.DOORDASH_KEY_ID!
  const signingSecret = process.env.DOORDASH_SIGNING_SECRET!
  return jwt.sign(
    { aud: 'doordash', iss: developerId, kid: keyId, exp: Math.floor(Date.now() / 1000) + 300 },
    Buffer.from(signingSecret, 'base64'),
    { algorithm: 'HS256', header: { dd_ver: 'DD-JWT-V1', kid: keyId } as any },
  )
}

export const doordashDispatch = functions.https.onCall(async (request) => {
  const { auth, data } = request
  if (!auth) throw new functions.https.HttpsError('unauthenticated', 'Must be signed in')

  const { orderId } = data
  const orderSnap = await db.collection('orders').doc(orderId).get()
  if (!orderSnap.exists) throw new functions.https.HttpsError('not-found', 'Order not found')

  const order = orderSnap.data()!
  const token = buildJwt()

  const resp = await fetch(`${DOORDASH_BASE}/drive/v2/deliveries`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      external_delivery_id: `order_${orderId}`,
      pickup_address: RESTAURANT_ADDRESS,
      pickup_phone_number: RESTAURANT_PHONE,
      pickup_instructions: `Order #${orderId.slice(-6).toUpperCase()}`,
      dropoff_address: `${order.deliveryAddress.street}, ${order.deliveryAddress.city}, ${order.deliveryAddress.state} ${order.deliveryAddress.zip}`,
      dropoff_phone_number: order.guestPhone || '',
      dropoff_contact_given_name: order.guestPhone ? 'Customer' : '',
      dropoff_instructions: order.deliveryAddress.instructions ?? '',
      order_value: order.subtotal,
      tip: order.tip,
    }),
  })

  if (!resp.ok) {
    const err: any = await resp.json()
    throw new functions.https.HttpsError('internal', `DoorDash dispatch failed: ${err.message}`)
  }

  const result: any = await resp.json()

  await db.collection('orders').doc(orderId).update({
    doordashDeliveryId: result.external_delivery_id,
    doordashTrackingUrl: result.tracking_url ?? '',
    status: 'confirmed',
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  })

  return { success: true, trackingUrl: result.tracking_url }
})
