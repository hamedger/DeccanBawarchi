import * as functions from 'firebase-functions/v2'
import * as admin from 'firebase-admin'
import Stripe from 'stripe'

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
      await db.collection('orders').doc(orderId).update({
        status: 'confirmed',
        stripePaymentIntentId: pi.id,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      })
    }
  }

  res.sendStatus(200)
})
