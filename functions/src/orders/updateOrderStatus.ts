import * as functions from 'firebase-functions/v2'
import * as admin from 'firebase-admin'
import { FieldValue } from 'firebase-admin/firestore'
import { isAdminUser } from '../admin/isAdmin'
import { getAdapterForProvider } from '../delivery/activeProvider'
import { doordashSecrets } from '../delivery/doordashConfig'
import { uberDirectSecrets } from '../delivery/uberDirectConfig'

if (!admin.apps.length) admin.initializeApp()
const db = admin.firestore()

const USER_CANCELLABLE_STATUSES = ['pending', 'placed', 'confirmed', 'preparing']

async function cancelDispatchedDelivery(order: {
  deliveryProvider?: string
  deliveryExternalId?: string
  deliveryExternalQuoteId?: string
}): Promise<void> {
  if (order.deliveryProvider !== 'doordash' && order.deliveryProvider !== 'uber_direct') return
  const externalId = String(order.deliveryExternalId ?? order.deliveryExternalQuoteId ?? '').trim()
  if (!externalId) return

  try {
    await getAdapterForProvider(order.deliveryProvider).cancel(externalId)
  } catch (err) {
    functions.logger.warn('Delivery provider cancel failed; proceeding with local cancel', {
      provider: order.deliveryProvider,
      externalId,
      err,
    })
  }
}

export const updateOrderStatus = functions.https.onCall(
  { secrets: [...doordashSecrets, ...uberDirectSecrets] },
  async (request) => {
  const { auth, data } = request
  if (!auth) throw new functions.https.HttpsError('unauthenticated', 'Must be signed in')

  const isAdmin = await isAdminUser(auth.uid)

  const { orderId, status } = data
  const validStatuses = ['pending', 'placed', 'confirmed', 'preparing', 'ready', 'picked_up', 'delivered', 'cancelled']
  if (!validStatuses.includes(status)) {
    throw new functions.https.HttpsError('invalid-argument', 'Invalid status')
  }

  const orderRef = db.collection('orders').doc(orderId)
  const orderSnap = await orderRef.get()
  if (!orderSnap.exists) {
    throw new functions.https.HttpsError('not-found', 'Order not found')
  }

  const order = orderSnap.data() as {
    userId?: string
    status?: string
    fulfillmentType?: string
    deliveryProvider?: string
    deliveryExternalId?: string
    deliveryExternalQuoteId?: string
  }

  if (!isAdmin) {
    if (status !== 'cancelled') {
      throw new functions.https.HttpsError('permission-denied', 'Only admins can update order status')
    }
    if (order.userId !== auth.uid) {
      throw new functions.https.HttpsError('permission-denied', 'You can only cancel your own orders')
    }
    if (!order.status || !USER_CANCELLABLE_STATUSES.includes(order.status)) {
      throw new functions.https.HttpsError(
        'failed-precondition',
        'This order can no longer be cancelled online. Please call the restaurant.',
      )
    }
  }

  if (status === 'cancelled' && order.fulfillmentType === 'delivery') {
    await cancelDispatchedDelivery(order)
  }

  await db.collection('orders').doc(orderId).update({
    status,
    updatedAt: FieldValue.serverTimestamp(),
  })

  // Loyalty points are awarded by the awardLoyaltyOnDelivery Firestore trigger.

  return { success: true }
  },
)
