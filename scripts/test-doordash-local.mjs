/**
 * Smoke-test DoorDash Cloud Functions against the local emulator.
 *
 * Prerequisites:
 *   1. Terminal A: npm run functions:serve
 *   2. functions/.env has real DOORDASH_* credentials
 *
 * Quote test auth (pick one):
 *   - FIREBASE_ID_TOKEN from browser devtools after sign-in
 *   - TEST_USER_EMAIL + TEST_USER_PASSWORD (may fail if API key has referrer restrictions)
 *
 * Usage:
 *   npm run test:doordash-local
 *   FIREBASE_ID_TOKEN=eyJ... npm run test:doordash-local
 */
import { config } from 'dotenv'
import { initializeApp } from 'firebase/app'
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth'
import { connectFunctionsEmulator, getFunctions, httpsCallable } from 'firebase/functions'

config({ path: '.env' })

const projectId = process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID
const emulatorHost = process.env.EXPO_PUBLIC_FUNCTIONS_EMULATOR_HOST ?? '127.0.0.1'
const emulatorPort = Number(process.env.EXPO_PUBLIC_FUNCTIONS_EMULATOR_PORT ?? 5001)
const idToken = process.env.FIREBASE_ID_TOKEN
const testEmail = process.env.TEST_USER_EMAIL
const testPassword = process.env.TEST_USER_PASSWORD

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

const dropoffAddress = process.env.TEST_DROPOFF_ADDRESS ?? '123 Main St, Northville, MI 48167'
const orderValue = Number(process.env.TEST_ORDER_VALUE ?? 2500)

console.log(`\nDoorDash local test → emulator ${emulatorHost}:${emulatorPort}\n`)

async function testQuote() {
  console.log('1) doordashQuote (callable, requires auth)')

  if (idToken) {
    const url = `http://${emulatorHost}:${emulatorPort}/${projectId}/us-central1/doordashQuote`
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({ data: { dropoffAddress, orderValue } }),
    })
    const body = await resp.json()
    if (!resp.ok) throw new Error(JSON.stringify(body))
    console.log('   Quote OK:', body.result ?? body)
    return
  }

  if (!testEmail || !testPassword) {
    console.log('   Skipped — set FIREBASE_ID_TOKEN or TEST_USER_EMAIL + TEST_USER_PASSWORD')
    console.log('   Tip: sign in on http://localhost:8081, then in devtools run:')
    console.log('   (await import("firebase/auth")).getAuth().currentUser.getIdToken()')
    return
  }

  await signInWithEmailAndPassword(auth, testEmail, testPassword)
  const quoteFn = httpsCallable(functions, 'doordashQuote')
  const { data } = await quoteFn({ dropoffAddress, orderValue })
  console.log('   Quote OK:', data)
}

async function testWebhook() {
  console.log('\n2) doordashWebhook (HTTP)')
  const url = `http://${emulatorHost}:${emulatorPort}/${projectId}/us-central1/doordashWebhook`
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      external_delivery_id: 'quote_smoke_test',
      event_name: 'dasher_confirmed',
    }),
  })
  const text = await resp.text()
  console.log(`   Webhook responded ${resp.status}${text ? ` — ${text}` : ''} (200 expected; ignores non-order_* ids)`)
  if (!resp.ok) throw new Error(`Webhook failed: ${resp.status}`)
}

try {
  await testQuote()
  await testWebhook()
  console.log('\nLocal DoorDash function checks finished.\n')
} catch (err) {
  console.error('\nTest failed:', err.message ?? err)
  process.exit(1)
}
