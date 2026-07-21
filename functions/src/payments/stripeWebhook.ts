import * as functions from 'firebase-functions/v2'
import * as admin from 'firebase-admin'
import { FieldValue } from 'firebase-admin/firestore'
import Stripe from 'stripe'

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
        updatedAt: FieldValue.serverTimestamp(),
      })
    }
  }

  res.sendStatus(200)
})
