import * as functions from 'firebase-functions/v2'
import * as admin from 'firebase-admin'
import { calculateEarnedPoints, validateRedemption } from '../constants/loyalty'

if (!admin.apps.length) admin.initializeApp()
const db = admin.firestore()

export const createOrder = functions.https.onCall(async (request) => {
  const { auth, data } = request

  if (!auth) throw new functions.https.HttpsError('unauthenticated', 'Must be signed in')

  const {
    items, subtotal, tax, deliveryFee = 0, serviceFee, tip = 0, promoCode = '', promoDiscount = 0,
    loyaltyPointsUsed = 0, giftCardAmount = 0, total, fulfillmentType,
    deliveryAddress, locationId, scheduledFor, pickupTime, notes,
  } = data

  if (!items?.length) throw new functions.https.HttpsError('invalid-argument', 'Cart is empty')

  const uid = auth.uid

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
  const userRef = db.collection('users').doc(uid)
  const loyaltyPointsEarned = calculateEarnedPoints(subtotal)

  try {
    await db.runTransaction(async (tx) => {
      const userSnap = await tx.get(userRef)
      if (!userSnap.exists()) {
        throw new Error('User profile not found')
      }
      const balance = userSnap.data()?.loyaltyPoints ?? 0
      validateRedemption(loyaltyPointsUsed, balance)

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
        loyaltyPointsEarned,
        loyaltyAwarded: false,
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

      tx.set(orderRef, order)

      if (loyaltyPointsUsed > 0) {
        tx.update(userRef, {
          loyaltyPoints: admin.firestore.FieldValue.increment(-loyaltyPointsUsed),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        })
      }
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Could not place order'
    if (
      message.includes('loyalty') ||
      message.includes('Insufficient') ||
      message.includes('increment')
    ) {
      throw new functions.https.HttpsError('failed-precondition', message)
    }
    if (message.includes('profile not found')) {
      throw new functions.https.HttpsError('failed-precondition', message)
    }
    throw new functions.https.HttpsError('internal', 'Could not place order')
  }

  return { orderId: orderRef.id }
})
