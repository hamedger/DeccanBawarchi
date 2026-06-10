import { onDocumentUpdated } from 'firebase-functions/v2/firestore'
import * as admin from 'firebase-admin'

if (!admin.apps.length) admin.initializeApp()
const db = admin.firestore()

export const awardLoyaltyOnDelivery = onDocumentUpdated('orders/{orderId}', async (event) => {
  const before = event.data?.before.data()
  const after = event.data?.after.data()
  if (!before || !after) return

  if (before.status === after.status || after.status !== 'delivered') return
  if (after.loyaltyAwarded === true) return
  if (!after.userId || after.userId === 'guest') return

  const earned = after.loyaltyPointsEarned ?? 0
  if (earned <= 0) return

  const orderRef = event.data!.after.ref
  const userRef = db.collection('users').doc(after.userId)

  await db.runTransaction(async (tx) => {
    const orderSnap = await tx.get(orderRef)
    const order = orderSnap.data()
    if (!order || order.loyaltyAwarded === true) return

    tx.update(orderRef, {
      loyaltyAwarded: true,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    })
    tx.update(userRef, {
      loyaltyPoints: admin.firestore.FieldValue.increment(earned),
      totalOrderCount: admin.firestore.FieldValue.increment(1),
      totalSpend: admin.firestore.FieldValue.increment(order.total ?? 0),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    })
  })
})
