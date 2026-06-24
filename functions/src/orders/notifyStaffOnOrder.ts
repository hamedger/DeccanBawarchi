import { onDocumentUpdated } from 'firebase-functions/v2/firestore'
import * as admin from 'firebase-admin'
import * as functions from 'firebase-functions/v2'
import { sendOrderNotificationEmail } from '../email/orderNotification'

if (!admin.apps.length) admin.initializeApp()
const db = admin.firestore()

export const notifyStaffOnOrder = onDocumentUpdated('orders/{orderId}', async (event) => {
  const before = event.data?.before.data()
  const after = event.data?.after.data()
  if (!after) return

  if (before?.status === 'confirmed' || after.status !== 'confirmed') return
  if (after.staffNotified === true) return

  const orderId = event.params.orderId
  const orderRef = event.data!.after.ref

  let customerEmail = String(after.guestEmail ?? '').trim()
  let customerPhone = String(after.guestPhone ?? '').trim()

  if (after.userId && after.userId !== 'guest') {
    try {
      const userSnap = await db.collection('users').doc(after.userId).get()
      if (userSnap.exists) {
        const user = userSnap.data()!
        if (!customerEmail) customerEmail = String(user.email ?? '').trim()
        if (!customerPhone) customerPhone = String(user.phone ?? '').trim()
      }
    } catch (error) {
      functions.logger.warn('Could not load user profile for order notification', { orderId, error })
    }
  }

  try {
    await sendOrderNotificationEmail({
      orderId,
      locationId: String(after.locationId ?? 'northville-mi'),
      fulfillmentType: String(after.fulfillmentType ?? 'pickup'),
      total: Number(after.total ?? 0),
      items: Array.isArray(after.items) ? after.items : [],
      pickupTime: after.pickupTime ? String(after.pickupTime) : null,
      scheduledFor: after.scheduledFor ? String(after.scheduledFor) : null,
      notes: String(after.notes ?? ''),
      customerEmail: customerEmail || undefined,
      customerPhone: customerPhone || undefined,
    })

    await orderRef.update({
      staffNotified: true,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    })
  } catch (error) {
    functions.logger.error('Failed to send order notification email', { orderId, error })
  }
})
