import * as functions from 'firebase-functions/v2'
import * as admin from 'firebase-admin'

if (!admin.apps.length) admin.initializeApp()
const db = admin.firestore()

export const createOrder = functions.https.onCall(async (request) => {
  const { auth, data } = request

  if (!auth) throw new functions.https.HttpsError('unauthenticated', 'Must be signed in')

  const {
    items, subtotal, tax, deliveryFee = 0, serviceFee, tip = 0, promoCode = '', promoDiscount = 0,
    loyaltyPointsUsed = 0, giftCardAmount = 0, giftCardCode = '', total, fulfillmentType,
    deliveryAddress, locationId, scheduledFor, pickupTime, notes,
  } = data

  if (!items?.length) throw new functions.https.HttpsError('invalid-argument', 'Cart is empty')

  const uid = auth.uid

  // Rate limiting: 5 orders per user per hour
  const oneHourAgo = admin.firestore.Timestamp.fromDate(
    new Date(Date.now() - 60 * 60 * 1000),
  )
  const recentOrders = await db.collection('orders')
    .where('userId', '==', uid)
    .where('createdAt', '>=', oneHourAgo)
    .count()
    .get()

  if (recentOrders.data().count >= 5) {
    throw new functions.https.HttpsError('resource-exhausted', 'Order limit reached. Try again later.')
  }

  const orderRef = db.collection('orders').doc()

  const order = {
    id: orderRef.id,
    userId: uid,
    guestEmail: '',
    guestPhone: '',
    locationId,
    items,
    subtotal,
    tax,
    deliveryFee,
    serviceFee,
    tip,
    promoCode,
    promoDiscount,
    loyaltyPointsUsed,
    loyaltyPointsEarned: Math.floor(total / 100),
    giftCardAmount,
    total,
    fulfillmentType,
    scheduledFor: scheduledFor ?? null,
    pickupTime: pickupTime ?? null,
    deliveryAddress: deliveryAddress ?? null,
    status: 'pending',
    stripePaymentIntentId: '',
    doordashDeliveryId: '',
    doordashTrackingUrl: '',
    driverLocation: null,
    estimatedDeliveryTime: null,
    notes: notes ?? '',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }

  await orderRef.set(order)

  // Deduct loyalty points used
  if (loyaltyPointsUsed > 0) {
    await db.collection('users').doc(uid).update({
      loyaltyPoints: admin.firestore.FieldValue.increment(-loyaltyPointsUsed),
    })
  }

  return { orderId: orderRef.id }
})
