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

  // Loyalty points are awarded by the awardLoyaltyOnDelivery Firestore trigger.

  return { success: true }
})
