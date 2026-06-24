import * as functions from 'firebase-functions/v2'
import * as admin from 'firebase-admin'
import * as jwt from 'jsonwebtoken'
import fetch from 'node-fetch'

if (!admin.apps.length) admin.initializeApp()
const db = admin.firestore()
const DOORDASH_BASE = 'https://openapi.doordash.com'

function buildDoorDashJwt(): string {
  const developerId = process.env.DOORDASH_DEVELOPER_ID
  const keyId = process.env.DOORDASH_KEY_ID
  const signingSecret = process.env.DOORDASH_SIGNING_SECRET
  if (!developerId || !keyId || !signingSecret) {
    throw new functions.https.HttpsError(
      'failed-precondition',
      'DoorDash credentials are missing on the server',
    )
  }

  return jwt.sign(
    { aud: 'doordash', iss: developerId, kid: keyId, exp: Math.floor(Date.now() / 1000) + 300 },
    Buffer.from(signingSecret, 'base64'),
    { algorithm: 'HS256', header: { dd_ver: 'DD-JWT-V1', kid: keyId } as any },
  )
}

async function cancelDoorDashDelivery(externalDeliveryId: string) {
  const token = buildDoorDashJwt()
  const url = `${DOORDASH_BASE}/drive/v2/deliveries/${encodeURIComponent(externalDeliveryId)}/cancel`
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: '{}',
  })

  if (resp.ok) return

  let errorMessage = `DoorDash cancel failed (${resp.status})`
  try {
    const err = (await resp.json()) as { message?: string; error?: string }
    errorMessage = err.message || err.error || errorMessage
  } catch {
    // keep fallback message
  }
  throw new functions.https.HttpsError('failed-precondition', errorMessage)
}

export const updateOrderStatus = functions.https.onCall(async (request) => {
  const { auth, data } = request
  if (!auth) throw new functions.https.HttpsError('unauthenticated', 'Must be signed in')

  const tokenResult = await admin.auth().getUser(auth.uid)
  const claims = (tokenResult.customClaims ?? {}) as Record<string, unknown>
  if (!claims.admin) throw new functions.https.HttpsError('permission-denied', 'Admin only')

  const { orderId, status } = data
  const validStatuses = ['pending', 'confirmed', 'preparing', 'ready', 'picked_up', 'delivered', 'cancelled']
  if (!validStatuses.includes(status)) {
    throw new functions.https.HttpsError('invalid-argument', 'Invalid status')
  }

  const orderRef = db.collection('orders').doc(orderId)
  const orderSnap = await orderRef.get()
  if (!orderSnap.exists) {
    throw new functions.https.HttpsError('not-found', 'Order not found')
  }

  const order = orderSnap.data() as {
    fulfillmentType?: string
    doordashDeliveryId?: string
  }
  if (status === 'cancelled' && order.fulfillmentType === 'delivery') {
    const externalDeliveryId = order.doordashDeliveryId?.trim() || `order_${orderId}`
    await cancelDoorDashDelivery(externalDeliveryId)
  }

  await db.collection('orders').doc(orderId).update({
    status,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  })

  // Loyalty points are awarded by the awardLoyaltyOnDelivery Firestore trigger.

  return { success: true }
})
