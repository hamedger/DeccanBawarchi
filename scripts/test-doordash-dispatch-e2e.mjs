/**
 * E2E local: Clover confirm -> DoorDash dispatch -> webhook status update.
 *
 * Prerequisites:
 *   1) Terminal A: npm run functions:serve:doordash
 *   2) functions/.env has DOORDASH_* sandbox credentials
 *
 * Usage:
 *   npm run test:doordash-dispatch-e2e
 */
import { config as loadEnv } from 'dotenv'
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

const projectId = process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID
const functionsHost = process.env.EXPO_PUBLIC_FUNCTIONS_EMULATOR_HOST ?? '127.0.0.1'
const functionsPort = Number(process.env.EXPO_PUBLIC_FUNCTIONS_EMULATOR_PORT ?? 5001)
const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST ?? '127.0.0.1'
const authPort = Number(process.env.FIREBASE_AUTH_EMULATOR_PORT ?? 9099)
const testEmail = process.env.AUTH_EMULATOR_EMAIL ?? 'dispatch.e2e@deccan.local'
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
        `Auth emulator not reachable at ${authHost}:${authPort}. Start: npm run functions:serve:doordash`,
      )
    }
    throw err
  }
}

async function createPendingDeliveryOrder(uid) {
  const orderId = `dd_e2e_${Date.now()}`
  const checkoutSessionId = `sess_${Date.now()}`
  const deliveryAddress = {
    street: '123 Main St',
    city: 'Northville',
    state: 'MI',
    zip: '48167',
    instructions: 'DoorDash dispatch e2e',
  }
  const subtotal = 1499
  const tax = 90
  const deliveryFee = 975
  const tip = 200
  const total = subtotal + tax + deliveryFee + tip

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
    scheduledFor: null,
    pickupTime: null,
    deliveryAddress,
    status: 'pending',
    cloverCheckoutSessionId: checkoutSessionId,
    cloverPaymentId: '',
    stripePaymentIntentId: '',
    doordashDeliveryId: '',
    doordashTrackingUrl: '',
    driverLocation: null,
    estimatedDeliveryTime: null,
    notes: 'DoorDash Clover dispatch e2e',
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  })

  return { orderId, checkoutSessionId, total, deliveryFee }
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

    const dispatchError = String(order.doordashDispatchError ?? '').trim()
    if (dispatchError) {
      throw new Error(`DoorDash dispatch failed: ${dispatchError}`)
    }

    const deliveryId = String(order.doordashDeliveryId ?? '').trim()
    if (deliveryId) {
      console.log(`   Dispatch OK on poll ${i}:`, {
        status: order.status,
        doordashDeliveryId: deliveryId,
        doordashTrackingUrl: order.doordashTrackingUrl || '(none)',
      })
      return order
    }

    console.log(`   poll ${i}: status=${order.status}, waiting for dispatch…`)
  }

  return null
}

async function dispatchDirect(orderId) {
  console.log('   Firestore trigger did not dispatch in time — calling doordashDispatch directly')
  const dispatchFn = httpsCallable(functions, 'doordashDispatch')
  const { data } = await dispatchFn({ orderId })
  console.log('   Direct dispatch OK:', data)
}

async function ensureFirestoreEmulator() {
  try {
    const resp = await fetch(`http://${process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080'}/`)
    if (!resp.ok && resp.status !== 404) {
      throw new Error(`Unexpected Firestore emulator response (${resp.status})`)
    }
  } catch {
    throw new Error(
      'Firestore emulator is not running on 127.0.0.1:8080. Start full stack: npm run functions:serve:doordash (requires JDK 21+). Lite mode (functions:serve:doordash:lite) is not enough for this test.',
    )
  }
}

async function postWebhook(orderId) {
  const url = `http://${functionsHost}:${functionsPort}/${projectId}/us-central1/doordashWebhook`
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      external_delivery_id: `order_${orderId}`,
      event_name: 'dasher_confirmed',
      dasher_location: { lat: 42.431, lng: -83.483 },
    }),
  })
  const text = await resp.text()
  console.log(`   Webhook responded ${resp.status}${text ? ` — ${text}` : ''}`)
  if (!resp.ok) throw new Error(`Webhook failed (${resp.status})`)
}

console.log(`\nDoorDash dispatch e2e → emulators (functions ${functionsHost}:${functionsPort}, firestore ${process.env.FIRESTORE_EMULATOR_HOST})\n`)

try {
  await ensureFirestoreEmulator()

  console.log('1) Auth emulator sign-in')
  await ensureAuthUser()
  const uid = auth.currentUser?.uid
  if (!uid) throw new Error('No auth uid after sign-in')
  console.log(`   Signed in as ${testEmail} (${uid})`)

  console.log('\n2) Seed pending delivery order in Firestore emulator')
  const { orderId, checkoutSessionId, total, deliveryFee } = await createPendingDeliveryOrder(uid)
  console.log(`   Order ${orderId} · total $${(total / 100).toFixed(2)} · delivery $${(deliveryFee / 100).toFixed(2)}`)

  console.log('\n3) confirmCloverOrder (simulates Clover success redirect)')
  const confirmResult = await confirmOrder(orderId, checkoutSessionId)
  console.log('   Confirm OK:', confirmResult)

  console.log('\n4) Wait for onOrderConfirmedDispatch -> DoorDash sandbox dispatch')
  let dispatched = await pollDispatch(orderId, 8)
  if (!dispatched) {
    await dispatchDirect(orderId)
    dispatched = await pollDispatch(orderId, 12)
    if (!dispatched) {
      throw new Error('Timed out waiting for doordashDeliveryId after confirm + direct dispatch')
    }
  }

  console.log('\n5) doordashWebhook (dasher_confirmed -> order status confirmed)')
  await postWebhook(orderId)

  const finalSnap = await db.collection('orders').doc(orderId).get()
  const final = finalSnap.data()
  if (final?.status !== 'confirmed') {
    throw new Error(`Expected status confirmed after webhook, got ${final?.status}`)
  }

  console.log('\nDoorDash Clover dispatch e2e passed.\n')
} catch (err) {
  console.error('\nE2E failed:', err.message ?? err)
  process.exit(1)
}
