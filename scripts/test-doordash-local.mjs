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
 *     (fails if API key has HTTP referrer restrictions)
 *
 * Usage:
 *   npm run test:doordash-local
 *   FIREBASE_ID_TOKEN=eyJ... npm run test:doordash-local
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
const emulatorEmail =
  process.env.AUTH_EMULATOR_EMAIL ?? 'test@deccan.local'
const emulatorPassword =
  process.env.AUTH_EMULATOR_PASSWORD ?? 'testpass123'
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

const dropoffAddress = process.env.TEST_DROPOFF_ADDRESS ?? '123 Main St, Northville, MI 48167'
const orderValue = Number(process.env.TEST_ORDER_VALUE ?? 2500)

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
      if (err?.code === 'auth/network-request-failed') {
        throw new Error(
          `Auth emulator not reachable at ${authEmulatorHost}:${authEmulatorPort}. Start Terminal A with: npm run functions:serve:doordash`,
        )
      }
      throw err
    }
    return
  }

  if (!productionEmail || !productionPassword) {
    throw new Error(
      'Set TEST_USER_EMAIL + TEST_USER_PASSWORD, FIREBASE_ID_TOKEN, or run with auth emulator: npm run functions:serve:doordash',
    )
  }

  try {
    await signInWithEmailAndPassword(auth, productionEmail, productionPassword)
  } catch (err) {
    if (err?.code?.includes('requests-from-referer')) {
      throw new Error(
        'Firebase API key blocks CLI sign-in. Use npm run functions:serve:doordash (Terminal A) and retry, or set FIREBASE_ID_TOKEN from the browser after sign-in.',
      )
    }
    throw err
  }
}

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

  if (useAuthEmulator) {
    console.log(`   Using auth emulator ${authEmulatorHost}:${authEmulatorPort} as ${emulatorEmail}`)
  }

  await signInForQuote()
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
