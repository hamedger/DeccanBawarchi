/**
 * End-to-end local check: Stripe webhook -> order confirm -> DoorDash dispatch fields.
 *
 * Prerequisites:
 *   1) Terminal A: npm run functions:serve:doordash  (must include firestore emulator)
 *   2) functions/.env has STRIPE_WEBHOOK_SECRET + DoorDash credentials
 *
 * Usage:
 *   npm run test:stripe-webhook-local
 */
import { config as loadEnv } from 'dotenv'
import { createHmac } from 'crypto'
import { initializeApp } from 'firebase-admin/app'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'

loadEnv({ path: '.env' })
loadEnv({ path: 'functions/.env', override: true })

process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080'

const projectId = process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID
const functionsHost = process.env.EXPO_PUBLIC_FUNCTIONS_EMULATOR_HOST ?? '127.0.0.1'
const functionsPort = Number(process.env.EXPO_PUBLIC_FUNCTIONS_EMULATOR_PORT ?? 5001)
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

if (!projectId) {
  console.error('Missing EXPO_PUBLIC_FIREBASE_PROJECT_ID in .env')
  process.exit(1)
}
if (!webhookSecret) {
  console.error('Missing STRIPE_WEBHOOK_SECRET in functions/.env')
  process.exit(1)
}

initializeApp({ projectId })
const db = getFirestore()

const orderId = `stripe_local_${Date.now()}`
const orderRef = db.collection('orders').doc(orderId)

const deliveryAddress = {
  street: '123 Main St',
  city: 'Northville',
  state: 'MI',
  zip: '48167',
  instructions: 'Unit test',
}

console.log(`Creating local test order: ${orderId}`)
await orderRef.set({
  id: orderId,
  userId: 'local-test-user',
  guestEmail: 'local@test.com',
  guestPhone: '+12485550100',
  locationId: 'northville-mi',
  items: [{ name: 'Chicken Biryani', quantity: 1, price: 1499 }],
  subtotal: 1499,
  tax: 90,
  deliveryFee: 975,
  serviceFee: 0,
  tip: 200,
  promoCode: '',
  promoDiscount: 0,
  loyaltyPointsUsed: 0,
  loyaltyPointsEarned: 0,
  loyaltyAwarded: false,
  giftCardAmount: 0,
  total: 2764,
  fulfillmentType: 'delivery',
  scheduledFor: null,
  pickupTime: null,
  deliveryAddress,
  status: 'pending',
  stripePaymentIntentId: '',
  doordashDeliveryId: '',
  doordashTrackingUrl: '',
  driverLocation: null,
  estimatedDeliveryTime: null,
  notes: 'Stripe webhook local e2e test',
  createdAt: Timestamp.now(),
  updatedAt: Timestamp.now(),
})

const payload = JSON.stringify({
  id: `evt_local_${Date.now()}`,
  object: 'event',
  type: 'payment_intent.succeeded',
  data: {
    object: {
      id: `pi_local_${Date.now()}`,
      object: 'payment_intent',
      metadata: { orderId },
    },
  },
})

const timestamp = Math.floor(Date.now() / 1000)
const signedPayload = `${timestamp}.${payload}`
const v1 = createHmac('sha256', webhookSecret).update(signedPayload, 'utf8').digest('hex')
const stripeSignature = `t=${timestamp},v1=${v1}`

const webhookUrl = `http://${functionsHost}:${functionsPort}/${projectId}/us-central1/stripeWebhook`
const webhookResp = await fetch(webhookUrl, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'stripe-signature': stripeSignature,
  },
  body: payload,
})

const body = await webhookResp.text()
console.log(`stripeWebhook responded ${webhookResp.status}${body ? ` - ${body}` : ''}`)
if (!webhookResp.ok) {
  throw new Error('stripeWebhook failed')
}

await new Promise((resolve) => setTimeout(resolve, 1200))
const updated = (await orderRef.get()).data()
if (!updated) throw new Error('Order missing after webhook')

console.log('Order status:', updated.status)
console.log('stripePaymentIntentId:', updated.stripePaymentIntentId)
console.log('doordashDeliveryId:', updated.doordashDeliveryId || '(empty)')
console.log('doordashTrackingUrl:', updated.doordashTrackingUrl || '(empty)')
console.log('doordashDispatchError:', updated.doordashDispatchError || '(none)')

const ok =
  updated.status === 'placed' &&
  typeof updated.stripePaymentIntentId === 'string' &&
  updated.stripePaymentIntentId.length > 0 &&
  typeof updated.doordashDeliveryId === 'string' &&
  updated.doordashDeliveryId.length > 0

if (!ok) {
  throw new Error('E2E check failed: expected placed + stripePaymentIntentId + doordashDeliveryId')
}

console.log('\nStripe -> DoorDash dispatch local e2e passed.\n')
