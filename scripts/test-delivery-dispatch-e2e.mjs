/**
 * E2E (emulators): Clover confirm -> dispatch trigger -> provider dispatch -> webhook status.
 *
 * Works against whichever provider is currently active — set DELIVERY_PROVIDER in
 * functions/.env to 'doordash' or 'uber_direct' (alongside that provider's real sandbox
 * credentials) before starting the emulator, matching the flag this script targets.
 *
 * Prerequisites:
 *   1) Terminal A: npm run functions:serve:full  (starts functions + auth + firestore emulators)
 *   2) functions/.env has:
 *        DELIVERY_PROVIDER=doordash|uber_direct
 *        + that provider's real sandbox credentials (DOORDASH_* or UBER_DIRECT_*)
 *
 * Usage:
 *   node scripts/test-delivery-dispatch-e2e.mjs --provider doordash
 *   node scripts/test-delivery-dispatch-e2e.mjs --provider uber_direct
 */
import { config as loadEnv } from 'dotenv'
import { createHmac } from 'crypto'
import { initializeApp as initClientApp } from 'firebase/app'
import {
  connectAuthEmulator,
  createUserWithEmailAndPassword,
  getAuth,
  signInWithEmailAndPassword,
} from 'firebase/auth'
import { connectFunctionsEmulator, getFunctions, httpsCallable } from 'firebase/functions'
import { initializeApp as initAdminApp } from 'firebase-admin/app'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'

loadEnv({ path: '.env' })
loadEnv({ path: 'functions/.env', override: true })

process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080'

const provider = process.argv.includes('--provider')
  ? process.argv[process.argv.indexOf('--provider') + 1]
  : process.env.DELIVERY_PROVIDER

if (provider !== 'doordash' && provider !== 'uber_direct') {
  console.error('Pass --provider doordash|uber_direct (or set DELIVERY_PROVIDER)')
  process.exit(1)
}

const projectId = process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID
const functionsHost = process.env.EXPO_PUBLIC_FUNCTIONS_EMULATOR_HOST ?? '127.0.0.1'
const functionsPort = Number(process.env.EXPO_PUBLIC_FUNCTIONS_EMULATOR_PORT ?? 5001)
const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST ?? '127.0.0.1'
const authPort = Number(process.env.FIREBASE_AUTH_EMULATOR_PORT ?? 9099)
const testEmail = process.env.AUTH_EMULATOR_EMAIL ?? `dispatch.e2e.${provider}@deccan.local`
const testPassword = process.env.AUTH_EMULATOR_PASSWORD ?? 'testpass123'

if (!projectId) {
  console.error('Missing EXPO_PUBLIC_FIREBASE_PROJECT_ID in .env')
  process.exit(1)
}

initAdminApp({ projectId })
const db = getFirestore()

const clientApp = initClientApp({
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
})
const auth = getAuth(clientApp)
connectAuthEmulator(auth, `http://${authHost}:${authPort}`, { disableWarnings: true })

const functions = getFunctions(clientApp, 'us-central1')
connectFunctionsEmulator(functions, functionsHost, functionsPort)

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function ensureAuthUser() {
  try {
    await signInWithEmailAndPassword(auth, testEmail, testPassword)
  } catch (err) {
    if (err?.code === 'auth/user-not-found') {
      await createUserWithEmailAndPassword(auth, testEmail, testPassword)
      return
    }
    if (err?.code === 'auth/network-request-failed') {
      throw new Error(
        `Auth emulator not reachable at ${authHost}:${authPort}. Start: npm run functions:serve:full`,
      )
    }
    throw err
  }
}

async function createPendingDeliveryOrder(uid) {
  const orderId = `dd_e2e_${provider}_${Date.now()}`
  const checkoutSessionId = `sess_${Date.now()}`
  const deliveryAddress = {
    street: '123 Main St',
    city: 'Northville',
    state: 'MI',
    zip: '48167',
    instructions: `${provider} dispatch e2e`,
  }
  const subtotal = 1499
  const tax = 90
  const deliveryFee = 975
  const tip = 200
  const total = subtotal + tax + deliveryFee + tip
  const externalQuoteId = `quote_e2e_${Date.now()}`

  // Seed the quote-integrity record createPendingOrder would normally verify against —
  // this script bypasses the real deliveryQuote callable and seeds the order directly.
  await db.collection('deliveryQuotes').doc(externalQuoteId).set({
    provider,
    feeCents: deliveryFee,
    locationId: 'northville-mi',
    createdAt: Timestamp.now(),
  })

  await db.collection('orders').doc(orderId).set({
    id: orderId,
    userId: uid,
    guestEmail: testEmail,
    guestPhone: '+12485550100',
    locationId: 'northville-mi',
    items: [{ menuItemId: 'chicken-biryani', name: 'Chicken Biryani', price: 1499, quantity: 1 }],
    subtotal,
    tax,
    deliveryFee,
    serviceFee: 0,
    tip,
    promoCode: '',
    promoDiscount: 0,
    loyaltyPointsUsed: 0,
    loyaltyPointsEarned: 0,
    loyaltyAwarded: false,
    giftCardAmount: 0,
    total,
    fulfillmentType: 'delivery',
    deliveryProvider: provider,
    deliveryExternalQuoteId: externalQuoteId,
    scheduledFor: null,
    pickupTime: null,
    deliveryAddress,
    status: 'pending',
    cloverCheckoutSessionId: checkoutSessionId,
    cloverPaymentId: '',
    stripePaymentIntentId: '',
    notes: `${provider} dispatch e2e`,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  })

  return { orderId, checkoutSessionId, externalQuoteId }
}

async function confirmOrder(orderId, checkoutSessionId) {
  const confirmFn = httpsCallable(functions, 'confirmCloverOrder')
  const { data } = await confirmFn({ orderId, checkoutSessionId })
  return data
}

async function pollDispatch(orderId, attempts = 20) {
  for (let i = 1; i <= attempts; i += 1) {
    await sleep(1000)
    const snap = await db.collection('orders').doc(orderId).get()
    const order = snap.data()
    if (!order) throw new Error('Order disappeared during dispatch poll')

    const dispatchError = String(order.deliveryDispatchError ?? '').trim()
    if (dispatchError) {
      throw new Error(`Dispatch failed: ${dispatchError}`)
    }

    const externalId = String(order.deliveryExternalId ?? '').trim()
    if (externalId) {
      console.log(`   Dispatch OK on poll ${i}:`, {
        status: order.status,
        deliveryExternalId: externalId,
        deliveryTrackingUrl: order.deliveryTrackingUrl || '(none)',
      })
      return order
    }

    console.log(`   poll ${i}: status=${order.status}, waiting for dispatch…`)
  }

  return null
}

function signDoorDashWebhook(rawBody) {
  return { headers: {} } // no signature check on this endpoint today — see doordashWebhook.ts
}

function signUberWebhook(rawBody) {
  const key = process.env.UBER_DIRECT_WEBHOOK_SIGNING_KEY
  if (!key) {
    throw new Error('Set UBER_DIRECT_WEBHOOK_SIGNING_KEY in functions/.env to test the Uber webhook')
  }
  const signature = createHmac('sha256', key).update(rawBody).digest('hex')
  return { headers: { 'x-uber-signature': signature } }
}

async function postWebhook(order) {
  const isDoorDash = provider === 'doordash'
  const path = isDoorDash ? 'doordashWebhook' : 'uberDirectWebhook'
  const url = `http://${functionsHost}:${functionsPort}/${projectId}/us-central1/${path}`

  const body = isDoorDash
    ? JSON.stringify({
        external_delivery_id: order.deliveryExternalId,
        event_name: 'DASHER_CONFIRMED',
        dasher_location: { lat: 42.431, lng: -83.483 },
      })
    : JSON.stringify({
        kind: 'event.delivery_status',
        data: {
          id: order.deliveryExternalId,
          status: 'pickup',
          courier: { location: { lat: 42.431, lng: -83.483 } },
        },
      })

  const { headers } = isDoorDash ? signDoorDashWebhook(body) : signUberWebhook(body)

  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body,
  })
  const text = await resp.text()
  console.log(`   Webhook responded ${resp.status}${text ? ` — ${text}` : ''}`)
  if (!resp.ok) throw new Error(`Webhook failed (${resp.status})`)
}

async function ensureFirestoreEmulator() {
  try {
    const resp = await fetch(`http://${process.env.FIRESTORE_EMULATOR_HOST}/`)
    if (!resp.ok && resp.status !== 404) {
      throw new Error(`Unexpected Firestore emulator response (${resp.status})`)
    }
  } catch {
    throw new Error('Firestore emulator is not running. Start: npm run functions:serve:full')
  }
}

console.log(`\nDelivery dispatch e2e (${provider}) → emulators (functions ${functionsHost}:${functionsPort})\n`)

try {
  await ensureFirestoreEmulator()

  console.log('1) Auth emulator sign-in')
  await ensureAuthUser()
  const uid = auth.currentUser?.uid
  if (!uid) throw new Error('No auth uid after sign-in')
  console.log(`   Signed in as ${testEmail} (${uid})`)

  console.log('\n2) Seed pending delivery order + quote-integrity record')
  const { orderId, checkoutSessionId } = await createPendingDeliveryOrder(uid)
  console.log(`   Order ${orderId}`)

  console.log('\n3) confirmCloverOrder (simulates Clover success redirect)')
  const confirmResult = await confirmOrder(orderId, checkoutSessionId)
  console.log('   Confirm OK:', confirmResult)

  console.log(`\n4) Wait for dispatchOnPlaced -> ${provider} sandbox dispatch`)
  const dispatched = await pollDispatch(orderId, 20)
  if (!dispatched) {
    throw new Error('Timed out waiting for deliveryExternalId after confirm')
  }

  console.log(`\n5) ${provider}Webhook (status update)`)
  await postWebhook(dispatched)

  const finalSnap = await db.collection('orders').doc(orderId).get()
  const final = finalSnap.data()
  console.log(`\nFinal order status: ${final?.status}`)
  console.log('\nDelivery dispatch e2e passed.\n')
} catch (err) {
  console.error('\nE2E failed:', err.message ?? err)
  process.exit(1)
}
