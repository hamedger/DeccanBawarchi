import * as functions from 'firebase-functions/v2'
import * as admin from 'firebase-admin'
import { sendOrderNotificationEmail } from '../email/orderNotification'
import {
  enrichCustomerContactFromUser,
  orderNotificationInputFromDoc,
} from '../email/orderNotificationInput'
import { getResendMailConfig, resendApiKey } from '../email/resendConfig'
import { hasOrderPayment } from './orderPayment'

if (!admin.apps.length) admin.initializeApp()
const db = admin.firestore()

const POST_PAYMENT_STATUSES = new Set(['placed', 'confirmed', 'preparing', 'ready'])

async function notifyStaffForPaidOrder(orderId: string) {
  const orderRef = db.collection('orders').doc(orderId)
  const claimedOrder = await db.runTransaction(async (tx) => {
    const snap = await tx.get(orderRef)
    if (!snap.exists) return null
    const current = snap.data()!
    if (current.staffNotified === true || !hasOrderPayment(current)) return null
    if (current.status === 'cancelled') return null
    tx.update(orderRef, {
      staffNotified: true,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    })
    return current
  })
  if (!claimedOrder) return

  try {
    const input = await enrichCustomerContactFromUser(
      db,
      claimedOrder,
      orderNotificationInputFromDoc(orderId, claimedOrder),
    )
    await sendOrderNotificationEmail(input, getResendMailConfig())
  } catch (err) {
    await orderRef.update({
      staffNotified: false,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    })
    throw err
  }
}

export const confirmCloverOrder = functions.https.onCall(
  { invoker: 'public', secrets: [resendApiKey] },
  async (request) => {
    const { auth, data } = request
    if (!auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Must be signed in')
    }

    const orderId = String(data?.orderId ?? '').trim()
    const checkoutSessionId = String(data?.checkoutSessionId ?? '').trim()

    if (!orderId || !checkoutSessionId) {
      throw new functions.https.HttpsError('invalid-argument', 'orderId and checkoutSessionId are required')
    }

    const orderRef = db.collection('orders').doc(orderId)

    const placedOrderId = await db.runTransaction(async (tx) => {
      const snap = await tx.get(orderRef)
      if (!snap.exists) {
        throw new functions.https.HttpsError('not-found', 'Order not found')
      }

      const order = snap.data()!
      if (order.userId !== auth.uid) {
        throw new functions.https.HttpsError('permission-denied', 'Not your order')
      }

      const storedSessionId = String(order.cloverCheckoutSessionId ?? '').trim()
      if (!storedSessionId || storedSessionId !== checkoutSessionId) {
        throw new functions.https.HttpsError('failed-precondition', 'Checkout session mismatch')
      }

      const status = String(order.status ?? '')
      if (POST_PAYMENT_STATUSES.has(status)) {
        return orderId
      }
      if (status !== 'pending') {
        throw new functions.https.HttpsError('failed-precondition', `Order is ${status}`)
      }

      tx.update(orderRef, {
        status: 'placed',
        cloverPaymentId: String(order.cloverPaymentId ?? '').trim() || `clover_${checkoutSessionId}`,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      })

      return orderId
    })

    functions.logger.info('Clover order placed after checkout redirect', {
      orderId: placedOrderId,
      checkoutSessionId,
      uid: auth.uid,
    })

    try {
      await notifyStaffForPaidOrder(placedOrderId)
    } catch (err) {
      functions.logger.error('Staff notification failed after Clover checkout redirect', {
        orderId: placedOrderId,
        err,
      })
    }

    return { orderId: placedOrderId, status: 'placed' }
  },
)
