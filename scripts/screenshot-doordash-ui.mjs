/**
 * Capture real browser UI screenshots for DoorDash delivery flow.
 *
 * Prerequisites:
 *   npm run functions:serve:doordash
 *
 * Usage:
 *   npm run screenshot:doordash-ui
 */
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { mkdir } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
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

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const OUT_DIR = resolve(ROOT, 'docs/screenshots/doordash')

loadEnv({ path: resolve(ROOT, '.env') })
loadEnv({ path: resolve(ROOT, 'functions/.env'), override: true })

process.env.FIRESTORE_EMULATOR_HOST =
  process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080'

const projectId = process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID
const functionsHost = process.env.EXPO_PUBLIC_FUNCTIONS_EMULATOR_HOST ?? '127.0.0.1'
const functionsPort = Number(process.env.EXPO_PUBLIC_FUNCTIONS_EMULATOR_PORT ?? 5001)
const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST ?? '127.0.0.1'
const authPort = Number(process.env.FIREBASE_AUTH_EMULATOR_PORT ?? 9099)
const testEmail = process.env.SCREENSHOT_USER_EMAIL ?? 'screenshot.doordash@deccan.local'
const testPassword = process.env.SCREENSHOT_USER_PASSWORD ?? 'screenshotpass123'
const webPort = Number(process.env.SCREENSHOT_WEB_PORT ?? 8092)
const BASE_URL = `http://127.0.0.1:${webPort}`

const WEB_ENV = {
  ...process.env,
  EXPO_PUBLIC_USE_FUNCTIONS_EMULATOR: 'true',
  EXPO_PUBLIC_USE_AUTH_EMULATOR: 'true',
  EXPO_PUBLIC_USE_FIRESTORE_EMULATOR: 'true',
  EXPO_PUBLIC_DELIVERY_ENABLED: 'true',
  EXPO_PUBLIC_SCREENSHOT_HELPERS: 'true',
}

let webChild = null

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function log(msg) {
  console.log(`[screenshot] ${msg}`)
}

async function ensureFirestoreEmulator() {
  try {
    const resp = await fetch(`http://${process.env.FIRESTORE_EMULATOR_HOST}/`)
    if (!resp.ok && resp.status !== 404) {
      throw new Error(`Unexpected Firestore emulator response (${resp.status})`)
    }
  } catch {
    throw new Error(
      'Firestore emulator is not running. Start: npm run functions:serve:doordash',
    )
  }
}

async function waitForUrl(url, attempts = 45) {
  for (let i = 0; i < attempts; i += 1) {
    try {
      const resp = await fetch(url)
      if (resp.ok || resp.status === 200) return true
    } catch {
      // still starting
    }
    await sleep(2000)
  }
  return false
}

async function ensureWebServer() {
  if (await waitForUrl(BASE_URL, 1)) return

  if (process.env.SCREENSHOT_SKIP_BUILD !== '1') {
    log('Building static web export with emulator env…')
  const build = spawn(
    'sh',
    [
      '-c',
      [
        'EXPO_PUBLIC_USE_FUNCTIONS_EMULATOR=true',
        'EXPO_PUBLIC_USE_AUTH_EMULATOR=true',
        'EXPO_PUBLIC_USE_FIRESTORE_EMULATOR=true',
        'EXPO_PUBLIC_DELIVERY_ENABLED=true',
        'EXPO_PUBLIC_SCREENSHOT_HELPERS=true',
        'npm run build',
      ].join(' '),
    ],
    {
      cwd: ROOT,
      env: process.env,
      stdio: 'inherit',
    },
  )
  await new Promise((resolve, reject) => {
    build.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`build failed (${code})`))))
  })
  } else {
    log('Skipping build (SCREENSHOT_SKIP_BUILD=1)')
  }

  log(`Serving dist on ${BASE_URL}`)
  webChild = spawn('npx', ['serve', 'dist', '-s', '-l', String(webPort)], {
    cwd: ROOT,
    env: process.env,
    stdio: 'pipe',
  })

  const ready = await waitForUrl(BASE_URL, 30)
  if (!ready) throw new Error(`Static web did not become ready at ${BASE_URL}`)
  log(`Web ready at ${BASE_URL}`)
}

async function seedEmulatorData(db) {
  const now = Timestamp.now()
  await db.collection('locations').doc('northville-mi').set({
    id: 'northville-mi',
    name: 'Deccan Bawarchi — Northville',
    address: {
      street: '17933 Haggerty Rd',
      city: 'Township of Northville',
      state: 'MI',
      zip: '48168',
      country: 'US',
    },
    phone: '+12489857209',
    website: 'https://deccanbawarchi.com',
    isActive: true,
    acceptsDelivery: true,
    acceptsPickup: true,
    acceptsReservations: true,
    acceptsCatering: true,
    deliveryRadius: 10,
    timezone: 'America/Detroit',
    pickupPrepBufferMinutes: 20,
    fulfillmentHours: { open: '11:30', close: '22:00' },
    hours: Object.fromEntries(
      Array.from({ length: 7 }, (_, day) => [day, { open: '11:30', close: '22:00' }]),
    ),
    createdAt: now,
    updatedAt: now,
  })

  await db.collection('menu').doc('chicken-biryani').set({
    id: 'chicken-biryani',
    name: 'Chicken Biryani',
    description: 'Fragrant basmati rice layered with spiced chicken.',
    price: 1499,
    category: 'biryani',
    isAvailable: true,
    isVegetarian: false,
    locationIds: ['northville-mi', 'farmington-hills-mi'],
    createdAt: now,
    updatedAt: now,
  })
}

async function ensureAuthUser(auth) {
  try {
    await signInWithEmailAndPassword(auth, testEmail, testPassword)
  } catch (err) {
    if (err?.code === 'auth/user-not-found') {
      await createUserWithEmailAndPassword(auth, testEmail, testPassword)
      return
    }
    throw err
  }
}

async function createPendingDeliveryOrder(db, uid) {
  const orderId = `dd_ui_${Date.now()}`
  const checkoutSessionId = `sess_${Date.now()}`
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
    deliveryAddress: {
      street: '123 Main St',
      city: 'Northville',
      state: 'MI',
      zip: '48167',
      instructions: 'DoorDash UI screenshot',
    },
    status: 'pending',
    cloverCheckoutSessionId: checkoutSessionId,
    cloverPaymentId: '',
    stripePaymentIntentId: '',
    doordashDeliveryId: '',
    doordashTrackingUrl: '',
    driverLocation: null,
    estimatedDeliveryTime: null,
    notes: 'DoorDash UI screenshot seed',
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  })

  return { orderId, checkoutSessionId }
}

async function pollDispatch(db, orderId, attempts = 15) {
  for (let i = 1; i <= attempts; i += 1) {
    await sleep(1000)
    const order = (await db.collection('orders').doc(orderId).get()).data()
    if (!order) throw new Error('Order missing during dispatch poll')
    const deliveryId = String(order.doordashDeliveryId ?? '').trim()
    if (deliveryId) return order
  }
  return null
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
  if (!resp.ok) throw new Error(`Webhook failed (${resp.status})`)
}

async function setupDispatchOrder() {
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

  log('Seeding Firestore emulator (location + menu item)')
  await seedEmulatorData(db)

  log('Creating auth user for browser session')
  await ensureAuthUser(auth)
  const uid = auth.currentUser?.uid
  if (!uid) throw new Error('No auth uid')

  const { orderId, checkoutSessionId } = await createPendingDeliveryOrder(db, uid)
  log(`Seeded order ${orderId}`)

  const confirmFn = httpsCallable(functions, 'confirmCloverOrder')
  await confirmFn({ orderId, checkoutSessionId })

  let order = await pollDispatch(db, orderId, 10)
  if (!order) {
    log('Calling doordashDispatch directly')
    const dispatchFn = httpsCallable(functions, 'doordashDispatch')
    await dispatchFn({ orderId })
    order = await pollDispatch(db, orderId, 12)
  }
  if (!order?.doordashDeliveryId) {
    throw new Error('Dispatch did not populate doordashDeliveryId')
  }

  return {
    orderId,
    doordashDeliveryId: order.doordashDeliveryId,
    doordashTrackingUrl: order.doordashTrackingUrl || '',
  }
}

async function signIn(page) {
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded', timeout: 120000 })
  await page.getByPlaceholder('you@email.com').waitFor({ timeout: 60000 })
  await page.getByPlaceholder('you@email.com').fill(testEmail)
  await page.locator('input[type="password"]').first().fill(testPassword)
  await page.getByText('Sign In', { exact: true }).click()
  await page.waitForURL((url) => !url.pathname.includes('login'), { timeout: 90000 })
  await sleep(2000)
}

async function addItemAndOpenCheckout(page) {
  await page.goto(`${BASE_URL}/cart`, { waitUntil: 'domcontentloaded', timeout: 120000 })
  await page.waitForFunction(() => typeof window.__seedCart === 'function', undefined, {
    timeout: 60000,
  })
  const itemCount = await page.evaluate(() => {
    window.__seedCart?.([
      {
        menuItemId: 'chicken-biryani',
        name: 'Chicken Biryani',
        price: 1499,
        quantity: 1,
      },
    ])
    return window.__cartItemCount?.() ?? 0
  })
  log(`Cart seeded with ${itemCount} item(s)`)
  if (itemCount < 1) throw new Error('Cart seed failed — rebuild with SCREENSHOT helpers enabled')

  await page.goto(`${BASE_URL}/checkout`, { waitUntil: 'domcontentloaded', timeout: 120000 })
  const debug = await page.evaluate(() => ({
    path: window.location.pathname,
    seed: sessionStorage.getItem('deccan_screenshot_cart'),
    items: window.__cartItemCount?.() ?? -1,
  }))
  log(`Checkout debug: ${JSON.stringify(debug)}`)
  await page.getByText('Review your order', { exact: false }).waitFor({ timeout: 90000 })
  await page.getByText(/Chicken Biryani/i).first().waitFor({ timeout: 30000 })
  await page.getByText('DoorDash Drive quote', { exact: false }).waitFor({ timeout: 90000 })
  await sleep(3000)
}

async function waitForLiveQuote(page) {
  await page.getByText('DoorDash Drive quote', { exact: false }).waitFor({ timeout: 60000 })
  await page.locator('text=/\\$\\d+\\.\\d{2} · ~\\d+ min/').first().waitFor({ timeout: 90000 })
  await page.getByText('DoorDash Delivery').first().waitFor({ timeout: 30000 })
}

async function injectDispatchOverlay(page, fields) {
  await page.evaluate((data) => {
    const existing = document.getElementById('dd-screenshot-overlay')
    if (existing) existing.remove()
    const el = document.createElement('div')
    el.id = 'dd-screenshot-overlay'
    el.style.cssText = [
      'position:fixed',
      'top:12px',
      'left:12px',
      'right:12px',
      'z-index:99999',
      'background:rgba(11,9,5,0.95)',
      'border:1px solid #d4af37',
      'border-radius:12px',
      'padding:14px 16px',
      'color:#f5f5f5',
      'font:13px/1.5 ui-monospace,Menlo,monospace',
      'box-shadow:0 8px 32px rgba(0,0,0,0.45)',
    ].join(';')
    el.innerHTML = [
      '<div style="color:#d4af37;font-weight:700;margin-bottom:8px">Dispatch success fields</div>',
      `<div><span style="color:#aaa">doordashDeliveryId:</span> ${data.doordashDeliveryId}</div>`,
      `<div style="margin-top:4px;word-break:break-all"><span style="color:#aaa">doordashTrackingUrl:</span> ${data.doordashTrackingUrl}</div>`,
    ].join('')
    document.body.appendChild(el)
  }, fields)
}

async function captureScreenshots(dispatch) {
  await mkdir(OUT_DIR, { recursive: true })

  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    deviceScaleFactor: 2,
  })
  await context.addInitScript(() => {
    window.localStorage.setItem('deccan_selected_location_id', 'northville-mi')
  })
  const page = await context.newPage()
  page.on('pageerror', (err) => log(`page error: ${err.message}`))

  try {
    log('Signing in and opening checkout')
    await signIn(page)
    await addItemAndOpenCheckout(page)
    await waitForLiveQuote(page)
    await page.screenshot({
      path: resolve(OUT_DIR, 'browser-step-1-checkout-quote.png'),
      fullPage: true,
    })
    log('Saved browser-step-1-checkout-quote.png')

    log('Opening order tracking after dispatch')
    await page.goto(`${BASE_URL}/order/${dispatch.orderId}`, {
      waitUntil: 'domcontentloaded',
      timeout: 90000,
    })
    await page.getByText('Track Driver in Real-Time', { exact: false }).waitFor({ timeout: 60000 })
    await injectDispatchOverlay(page, {
      doordashDeliveryId: dispatch.doordashDeliveryId,
      doordashTrackingUrl: dispatch.doordashTrackingUrl,
    })
    await page.screenshot({
      path: resolve(OUT_DIR, 'browser-step-2-dispatch-success-fields.png'),
      fullPage: true,
    })
    log('Saved browser-step-2-dispatch-success-fields.png')

    log('Posting dasher_confirmed webhook')
    await postWebhook(dispatch.orderId)
    await page.getByText('Confirmed', { exact: true }).waitFor({ timeout: 30000 })
    await page.evaluate(() => {
      const el = document.getElementById('dd-screenshot-overlay')
      if (el) el.remove()
    })
    await page.screenshot({
      path: resolve(OUT_DIR, 'browser-step-3-webhook-status-confirmed.png'),
      fullPage: true,
    })
    log('Saved browser-step-3-webhook-status-confirmed.png')
  } catch (err) {
    await page.screenshot({ path: resolve(OUT_DIR, 'debug-failure.png'), fullPage: true }).catch(() => {})
    throw err
  } finally {
    await browser.close()
  }
}

async function cleanup() {
  if (webChild && !webChild.killed) {
    webChild.kill('SIGTERM')
  }
}

if (!projectId) {
  console.error('Missing EXPO_PUBLIC_FIREBASE_PROJECT_ID')
  process.exit(1)
}

try {
  await ensureFirestoreEmulator()
  await ensureWebServer()
  const dispatch = await setupDispatchOrder()
  await captureScreenshots(dispatch)
  log(`Done. Browser screenshots saved to ${OUT_DIR}`)
} catch (err) {
  console.error('\nScreenshot capture failed:', err.message ?? err)
  process.exitCode = 1
} finally {
  await cleanup()
}
