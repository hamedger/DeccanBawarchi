import * as functions from 'firebase-functions/v2'
import * as admin from 'firebase-admin'
import fetch from 'node-fetch'
import { buildDoorDashJwt } from './doordashJwt'

if (!admin.apps.length) admin.initializeApp()

const db = admin.firestore()
const DOORDASH_BASE = 'https://openapi.doordash.com'
const RESTAURANT_ADDRESS = '17933 Haggerty Rd, Northville Township, MI 48168'
const RESTAURANT_PHONE = '+12489857209'

export async function dispatchOrderToDoorDash(orderId: string) {
  const orderSnap = await db.collection('orders').doc(orderId).get()
  if (!orderSnap.exists) throw new functions.https.HttpsError('not-found', 'Order not found')

  const order = orderSnap.data()!
  if (order.fulfillmentType !== 'delivery') {
    throw new functions.https.HttpsError('failed-precondition', 'Order is not delivery')
  }
  if (!order.deliveryAddress) {
    throw new functions.https.HttpsError('failed-precondition', 'Missing delivery address')
  }
  if (String(order.doordashDeliveryId ?? '').trim()) {
    return { success: true, trackingUrl: order.doordashTrackingUrl ?? '' }
  }
  const token = buildDoorDashJwt()

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
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  })

  return { success: true, trackingUrl: result.tracking_url }
}

export const doordashDispatch = functions.https.onCall(async (request) => {
  const { auth, data } = request
  if (!auth) throw new functions.https.HttpsError('unauthenticated', 'Must be signed in')
  const { orderId } = data
  return dispatchOrderToDoorDash(orderId)
})
