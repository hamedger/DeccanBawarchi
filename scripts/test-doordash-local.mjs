/**
 * Smoke-test DoorDash Cloud Functions against the local emulator.
 *
 * Prerequisites:
 *   1. Terminal A: npm run functions:serve:doordash
 *   2. functions/.env has real DOORDASH_* credentials
 *
 * Quote test auth (pick one):
 *   - Auth emulator (default) — uses test@deccan.local / testpass123
 *   - FIREBASE_ID_TOKEN from browser after sign-in on production auth
 *   - TEST_USER_EMAIL + TEST_USER_PASSWORD with USE_AUTH_EMULATOR=false
 *
 * Usage:
 *   npm run test:doordash-local
 */
import { config } from 'dotenv'
import { initializeApp } from 'firebase/app'
import {
  connectAuthEmulator,
  createUserWithEmailAndPassword,
  getAuth,
  signInWithEmailAndPassword,
} from 'firebase/auth'
import { connectFunctionsEmulator, getFunctions, httpsCallable } from 'firebase/functions'

config({ path: '.env' })

const projectId = process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID
const emulatorHost = process.env.EXPO_PUBLIC_FUNCTIONS_EMULATOR_HOST ?? '127.0.0.1'
const emulatorPort = Number(process.env.EXPO_PUBLIC_FUNCTIONS_EMULATOR_PORT ?? 5001)
const authEmulatorHost = process.env.FIREBASE_AUTH_EMULATOR_HOST ?? '127.0.0.1'
const authEmulatorPort = Number(process.env.FIREBASE_AUTH_EMULATOR_PORT ?? 9099)
const idToken = process.env.FIREBASE_ID_TOKEN
const useAuthEmulator = process.env.USE_AUTH_EMULATOR !== 'false' && !idToken
const emulatorEmail = process.env.AUTH_EMULATOR_EMAIL ?? 'test@deccan.local'
const emulatorPassword = process.env.AUTH_EMULATOR_PASSWORD ?? 'testpass123'
const productionEmail = process.env.TEST_USER_EMAIL
const productionPassword = process.env.TEST_USER_PASSWORD

if (!projectId) {
  console.error('Missing EXPO_PUBLIC_FIREBASE_PROJECT_ID in .env')
  process.exit(1)
}

const app = initializeApp({
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
})

const auth = getAuth(app)
const functions = getFunctions(app, 'us-central1')
connectFunctionsEmulator(functions, emulatorHost, emulatorPort)

const dropoffStreet = process.env.TEST_DROPOFF_STREET ?? '123 Main St'
const dropoffCity = process.env.TEST_DROPOFF_CITY ?? 'Northville'
const dropoffZip = process.env.TEST_DROPOFF_ZIP ?? '48167'
const orderValue = Number(process.env.TEST_ORDER_VALUE ?? 2500)
const dropoffPhone = process.env.TEST_DROPOFF_PHONE ?? '+12485550100'

console.log(`\nDoorDash local test → emulator ${emulatorHost}:${emulatorPort}\n`)

async function signInForQuote() {
  if (useAuthEmulator) {
    connectAuthEmulator(auth, `http://${authEmulatorHost}:${authEmulatorPort}`, {
      disableWarnings: true,
    })
    try {
      await signInWithEmailAndPassword(auth, emulatorEmail, emulatorPassword)
    } catch (err) {
      if (err?.code === 'auth/user-not-found') {
        await createUserWithEmailAndPassword(auth, emulatorEmail, emulatorPassword)
        return
      }
      throw err
    }
    return
  }

  if (!productionEmail || !productionPassword) {
    throw new Error('Set TEST_USER_EMAIL + TEST_USER_PASSWORD or use auth emulator')
  }
  await signInWithEmailAndPassword(auth, productionEmail, productionPassword)
}

const quotePayload = {
  dropoffAddress: `${dropoffStreet}, ${dropoffCity}, MI ${dropoffZip}`,
  dropoffStreet,
  dropoffCity,
  dropoffState: 'MI',
  dropoffZip,
  orderValue,
  dropoffPhoneNumber: dropoffPhone,
  dropoffContactGivenName: 'Test',
  items: [{ name: 'Chicken Biryani', quantity: 1, price: orderValue }],
}

async function testQuote() {
  if (idToken) {
    const url = `http://${emulatorHost}:${emulatorPort}/${projectId}/us-central1/doordashQuote`
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({ data: quotePayload }),
    })
    const body = await resp.json()
    if (!resp.ok) throw new Error(JSON.stringify(body))
    console.log('   Quote OK:', body.result ?? body)
    return
  }

  await signInForQuote()
  const quoteFn = httpsCallable(functions, 'doordashQuote')
  const { data } = await quoteFn(quotePayload)
  console.log('   Quote OK:', data)
}

async function testWebhook() {
  const url = `http://${emulatorHost}:${emulatorPort}/${projectId}/us-central1/doordashWebhook`
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      external_delivery_id: 'quote_smoke_test',
      event_name: 'DASHER_CONFIRMED',
    }),
  })
  const text = await resp.text()
  console.log(`   Webhook responded ${resp.status}${text ? ` — ${text}` : ''}`)
  if (!resp.ok) throw new Error(`Webhook failed: ${resp.status}`)
}

try {
  console.log('1) doordashQuote (POST /drive/v2/quotes via callable)')
  await testQuote()
  console.log('\n2) doordashWebhook (HTTP, ignores unknown external ids)')
  await testWebhook()
  console.log('\nLocal DoorDash function checks finished.\n')
} catch (err) {
  console.error('\nTest failed:', err.message ?? err)
  process.exit(1)
}
