import * as functions from 'firebase-functions/v2'
import * as admin from 'firebase-admin'

const db = admin.firestore()

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

  await db.collection('orders').doc(orderId).update({
    status,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  })

  // Award loyalty points on delivery
  if (status === 'delivered') {
    const orderSnap = await db.collection('orders').doc(orderId).get()
    const order = orderSnap.data()
    if (order?.userId && order.userId !== 'guest' && order.loyaltyPointsEarned > 0) {
      await db.collection('users').doc(order.userId).update({
        loyaltyPoints: admin.firestore.FieldValue.increment(order.loyaltyPointsEarned),
        totalOrderCount: admin.firestore.FieldValue.increment(1),
        totalSpend: admin.firestore.FieldValue.increment(order.total),
      })
    }
  }

  return { success: true }
})
