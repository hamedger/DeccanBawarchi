import { FieldValue } from 'firebase-admin/firestore'
import { config } from '../config'
import { db } from '../lib/firebase'
import { getCloverLocationConfig } from '../lib/cloverLocations'
import { trySendStaffOrderNotification } from './orderNotification'

const LOOKBACK_MS = 2 * 60 * 60 * 1000

/**
 * Imports orders placed on the Clover Online Ordering storefront (cloveronline.com)
 * into Firestore so they appear in Admin → Orders and trigger the staff email.
 *
 * Those orders never touch our checkout, so we poll Clover's REST API with a
 * merchant API token. Until CLOVER_ORDERS_IMPORT_ORDER_TYPES is set, the job only
 * logs a summary of each recent order — that's how we learn which Clover order
 * types are online orders vs. register sales or our own Hosted Checkout payments.
 */

interface CloverOrderImportConfig {
  apiToken: string
  merchantId: string
  locationId: string
  /** Lowercased Clover orderType labels to import; empty = log-only mode. */
  importOrderTypes: Set<string>
}

interface CloverElements<T> {
  elements?: T[]
}

interface CloverLineItem {
  id: string
  name?: string
  price?: number
  unitQty?: number
  note?: string
  refunded?: boolean
  exchanged?: boolean
  modifications?: CloverElements<{ name?: string }>
}

interface CloverCustomer {
  firstName?: string
  lastName?: string
  emailAddresses?: CloverElements<{ emailAddress?: string }>
  phoneNumbers?: CloverElements<{ phoneNumber?: string }>
}

interface CloverOrder {
  id: string
  total?: number
  state?: string
  paymentState?: string
  title?: string
  note?: string
  createdTime?: number
  manualTransaction?: boolean
  testMode?: boolean
  device?: { id?: string }
  orderType?: { id?: string; label?: string }
  lineItems?: CloverElements<CloverLineItem>
  customers?: CloverElements<CloverCustomer>
  payments?: CloverElements<{ id?: string; result?: string; tender?: { label?: string } }>
}

function readImportConfig(): CloverOrderImportConfig | null {
  const apiToken = process.env.CLOVER_ORDERS_API_TOKEN?.trim()
  if (!apiToken) return null

  const locationId = process.env.CLOVER_ORDERS_LOCATION_ID?.trim() || 'farmington-hills-mi'
  const merchantId =
    process.env.CLOVER_ORDERS_MERCHANT_ID?.trim() || getCloverLocationConfig(locationId).merchantId

  const importOrderTypes = new Set(
    (process.env.CLOVER_ORDERS_IMPORT_ORDER_TYPES ?? '')
      .split(',')
      .map((label) => label.trim().toLowerCase())
      .filter(Boolean),
  )

  return { apiToken, merchantId, locationId, importOrderTypes }
}

async function fetchRecentOrders(cfg: CloverOrderImportConfig, sinceMs: number): Promise<CloverOrder[]> {
  const params = new URLSearchParams({
    filter: `createdTime>=${sinceMs}`,
    expand: 'lineItems,lineItems.modifications,customers,customers.emailAddresses,customers.phoneNumbers,payments,orderType',
    orderBy: 'createdTime DESC',
    limit: '100',
  })
  const response = await fetch(
    `${config.clover.apiBaseUrl}/v3/merchants/${encodeURIComponent(cfg.merchantId)}/orders?${params}`,
    {
      headers: {
        accept: 'application/json',
        Authorization: `Bearer ${cfg.apiToken}`,
      },
      signal: AbortSignal.timeout(15_000),
    },
  )

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new Error(`Clover orders lookup failed (${response.status}): ${body}`)
  }

  const payload = (await response.json().catch(() => ({}))) as CloverElements<CloverOrder>
  return payload.elements ?? []
}

function isPaid(order: CloverOrder): boolean {
  if (String(order.paymentState ?? '').toUpperCase() === 'PAID') return true
  return (order.payments?.elements ?? []).some(
    (p) => String(p.result ?? '').toUpperCase() === 'SUCCESS',
  )
}

/** Non-PII summary used in log-only mode to tell online orders apart from other sources. */
function summarizeOrder(order: CloverOrder) {
  return {
    id: order.id,
    createdTime: order.createdTime ? new Date(order.createdTime).toISOString() : null,
    total: order.total ?? null,
    state: order.state ?? null,
    paymentState: order.paymentState ?? null,
    orderType: order.orderType?.label ?? null,
    title: order.title ?? null,
    deviceId: order.device?.id ?? null,
    manualTransaction: order.manualTransaction ?? null,
    testMode: order.testMode ?? null,
    lineItemCount: order.lineItems?.elements?.length ?? 0,
    hasCustomer: (order.customers?.elements?.length ?? 0) > 0,
    tenders: (order.payments?.elements ?? []).map((p) => p.tender?.label ?? null),
  }
}

/** Clover stores quantity as one line item per unit; collapse identical lines. */
function toOrderItems(order: CloverOrder) {
  const grouped = new Map<string, { menuItemId: string; name: string; price: number; quantity: number; instructions?: string }>()

  for (const line of order.lineItems?.elements ?? []) {
    if (line.refunded || line.exchanged) continue
    const name = line.name?.trim() || 'Item'
    const mods = (line.modifications?.elements ?? [])
      .map((m) => m.name?.trim())
      .filter(Boolean)
    const instructions = [...mods, line.note?.trim()].filter(Boolean).join(', ')
    const price = line.price ?? 0
    const key = `${name}|${price}|${instructions}`

    const existing = grouped.get(key)
    if (existing) {
      existing.quantity += 1
    } else {
      grouped.set(key, {
        menuItemId: `clover_${line.id}`,
        name,
        price,
        quantity: 1,
        ...(instructions ? { instructions } : {}),
      })
    }
  }

  return [...grouped.values()]
}

function toCustomer(order: CloverOrder) {
  const customer = order.customers?.elements?.[0]
  return {
    name: [customer?.firstName, customer?.lastName].filter(Boolean).join(' ').trim(),
    email: customer?.emailAddresses?.elements?.[0]?.emailAddress?.trim() ?? '',
    phone: customer?.phoneNumbers?.elements?.[0]?.phoneNumber?.trim() ?? '',
  }
}

/** Returns the Firestore order id when newly imported, null when it already existed. */
async function importOrder(cfg: CloverOrderImportConfig, order: CloverOrder): Promise<string | null> {
  const orderId = `clover_${order.id}`
  const orderRef = db.collection('orders').doc(orderId)
  const items = toOrderItems(order)
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0)
  const total = order.total ?? subtotal
  const customer = toCustomer(order)
  const orderTypeLabel = order.orderType?.label ?? ''
  const paymentId = order.payments?.elements?.[0]?.id?.trim() || `clover_order_${order.id}`

  try {
    // create() fails if the doc exists, so re-polling the same order is a no-op.
    await orderRef.create({
      id: orderId,
      source: 'clover_online',
      cloverOrderId: order.id,
      cloverOrderType: orderTypeLabel,
      userId: 'guest',
      guestName: customer.name,
      guestEmail: customer.email,
      guestPhone: customer.phone,
      locationId: cfg.locationId,
      items,
      subtotal,
      tax: Math.max(0, total - subtotal),
      deliveryFee: 0,
      serviceFee: 0,
      tip: 0,
      promoCode: '',
      promoDiscount: 0,
      loyaltyPointsUsed: 0,
      loyaltyPointsEarned: 0,
      loyaltyAwarded: false,
      giftCardAmount: 0,
      total,
      fulfillmentType: /deliver/i.test(orderTypeLabel) ? 'delivery' : 'pickup',
      scheduledFor: null,
      pickupTime: null,
      deliveryAddress: null,
      status: 'placed',
      stripePaymentIntentId: '',
      cloverMerchantId: cfg.merchantId,
      cloverCheckoutSessionId: '',
      cloverPaymentId: paymentId,
      notes: order.note?.trim() ?? '',
      createdAt: order.createdTime ? new Date(order.createdTime) : FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    })
    return orderId
  } catch (err) {
    if ((err as { code?: number }).code === 6) return null // ALREADY_EXISTS
    throw err
  }
}

export async function importCloverOnlineOrders(): Promise<void> {
  const cfg = readImportConfig()
  if (!cfg) return

  const orders = await fetchRecentOrders(cfg, Date.now() - LOOKBACK_MS)
  const logOnly = cfg.importOrderTypes.size === 0

  let imported = 0
  let notified = 0

  for (const order of orders) {
    if (logOnly) {
      console.log('[cloverOrderImport] Recent Clover order (log-only)', summarizeOrder(order))
      continue
    }

    const orderType = String(order.orderType?.label ?? '').trim().toLowerCase()
    if (!cfg.importOrderTypes.has(orderType) || !isPaid(order)) continue

    try {
      const orderId = await importOrder(cfg, order)
      if (!orderId) continue
      imported++
      console.log('[cloverOrderImport] Imported Clover order', { orderId, cloverOrderId: order.id })
      if (await trySendStaffOrderNotification(db, orderId)) notified++
    } catch (err) {
      console.error('[cloverOrderImport] Failed to import Clover order', { cloverOrderId: order.id, err })
    }
  }

  console.log('[cloverOrderImport] Poll cycle complete', {
    mode: logOnly ? 'log-only' : 'import',
    fetched: orders.length,
    imported,
    notified,
  })
}

export function startCloverOrderImportPoller(intervalMs = 60_000): NodeJS.Timeout | null {
  if (!process.env.CLOVER_ORDERS_API_TOKEN?.trim()) {
    console.warn('[cloverOrderImport] CLOVER_ORDERS_API_TOKEN not set — Clover online order import disabled')
    return null
  }

  const run = () =>
    importCloverOnlineOrders().catch((err) => {
      console.error('[cloverOrderImport] Poll cycle failed', err)
    })

  run()
  return setInterval(run, intervalMs)
}
