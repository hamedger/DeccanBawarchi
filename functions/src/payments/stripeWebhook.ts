import * as functions from 'firebase-functions/v2'
import * as admin from 'firebase-admin'
import Stripe from 'stripe'
import { dispatchOrderToDoorDash } from '../delivery/doordashDispatch'

if (!admin.apps.length) admin.initializeApp()
const db = admin.firestore()

export const stripeWebhook = functions.https.onRequest(async (req, res) => {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-06-20' })
  const sig = req.headers['stripe-signature']!
  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(req.rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch (err: any) {
    res.status(400).send(`Webhook Error: ${err.message}`)
    return
  }

  if (event.type === 'payment_intent.succeeded') {
    const pi = event.data.object as Stripe.PaymentIntent
    const orderId = pi.metadata.orderId
    if (orderId) {
      const orderRef = db.collection('orders').doc(orderId)
      await orderRef.update({
        status: 'placed',
        stripePaymentIntentId: pi.id,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      })

      const orderSnap = await orderRef.get()
      const order = orderSnap.data() as
        | { fulfillmentType?: string; doordashDeliveryId?: string }
        | undefined
      const shouldDispatch =
        order?.fulfillmentType === 'delivery' && !order?.doordashDeliveryId?.trim()
      if (shouldDispatch) {
        try {
          await dispatchOrderToDoorDash(orderId)
        } catch (err) {
          functions.logger.error('DoorDash dispatch failed after payment', {
            orderId,
            paymentIntentId: pi.id,
            err,
          })
          await orderRef.update({
            doordashDispatchError:
              err instanceof Error ? err.message : 'Unknown dispatch error',
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          })
        }
      }
    }
  }

  res.sendStatus(200)
})
