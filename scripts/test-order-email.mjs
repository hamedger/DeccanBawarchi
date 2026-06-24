/**
 * Send a sample order notification email via Resend.
 *
 * Usage:
 *   npm run test:order-email
 *   npm run test:order-email -- promitsinc@gmail.com
 *
 * Reads secrets from functions/.env:
 *   RESEND_API_KEY, RESEND_FROM_EMAIL, ORDERS_NOTIFICATION_EMAIL
 */
import { config } from 'dotenv'
import { randomBytes } from 'crypto'

config({ path: 'functions/.env' })

const LOCATION_LABELS = {
  'northville-mi': 'Northville',
  'farmington-hills-mi': 'Farmington Hills',
}

function formatCents(cents) {
  return `$${(cents / 100).toFixed(2)}`
}

function getLocationLabel(locationId) {
  return LOCATION_LABELS[locationId] ?? locationId
}

function buildSampleOrder() {
  const orderId = `test-${randomBytes(4).toString('hex')}`
  return {
    orderId,
    locationId: 'northville-mi',
    fulfillmentType: 'pickup',
    total: 4599,
    scheduledFor: '2026-06-24',
    pickupTime: '6:30 PM',
    notes: 'Sample test order — please ignore',
    customerEmail: 'promitsinc@gmail.com',
    customerPhone: '(248) 555-0100',
    items: [
      { name: 'Chicken Biryani', quantity: 2, price: 1499, instructions: 'Extra raita' },
      { name: 'Mix Veg Coco Curry', quantity: 1, price: 1299 },
      { name: 'Garlic Naan', quantity: 2, price: 399 },
    ],
  }
}

function buildSubject(order) {
  const location = getLocationLabel(order.locationId)
  const shortId = order.orderId.slice(-6).toUpperCase()
  const fulfillment = order.fulfillmentType === 'delivery' ? 'Delivery' : 'Pickup'
  return `[${location}] New Order #${shortId} — ${fulfillment} — ${formatCents(order.total)}`
}

function buildBody(order) {
  const location = getLocationLabel(order.locationId)
  const shortId = order.orderId.slice(-6).toUpperCase()
  const lines = [
    `New order at ${location}`,
    `Order ID: ${order.orderId} (#${shortId})`,
    `Fulfillment: ${order.fulfillmentType}`,
    `Total: ${formatCents(order.total)}`,
    `Scheduled: ${order.scheduledFor} ${order.pickupTime}`,
    `Customer email: ${order.customerEmail}`,
    `Customer phone: ${order.customerPhone}`,
    `Notes: ${order.notes}`,
    '',
    'Items:',
  ]

  for (const item of order.items) {
    const note = item.instructions ? ` (${item.instructions})` : ''
    lines.push(`- ${item.quantity}x ${item.name}${note} — ${formatCents(item.price * item.quantity)}`)
  }

  lines.push('', '— This is a test notification from scripts/test-order-email.mjs —')
  return lines.join('\n')
}

async function main() {
  const apiKey = process.env.RESEND_API_KEY?.trim()
  const fromEmail = process.env.RESEND_FROM_EMAIL?.trim() || 'onboarding@resend.dev'
  const toEmail = (process.argv[2] || process.env.TEST_ORDER_EMAIL || 'promitsinc@gmail.com').trim()

  if (!apiKey) {
    console.error('Missing RESEND_API_KEY in functions/.env')
    process.exit(1)
  }

  if (apiKey.includes('YOUR_') || apiKey.length < 30) {
    console.error('RESEND_API_KEY looks like a placeholder or is incomplete.')
    console.error('1. Create a key at https://resend.com/api-keys')
    console.error('2. Paste the full key into functions/.env')
    console.error('3. Save the file, then run: npm run test:order-email -- promitsinc@gmail.com')
    process.exit(1)
  }

  const order = buildSampleOrder()
  const subject = buildSubject(order)
  const text = buildBody(order)

  console.log(`Sending sample order email to ${toEmail}...`)
  console.log(`From: ${fromEmail}`)
  console.log(`Subject: ${subject}`)

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: `Deccan Bawarchi Orders <${fromEmail}>`,
      to: [toEmail],
      subject,
      text,
    }),
  })

  const payload = await response.text()
  if (!response.ok) {
    if (response.status === 401) {
      console.error('Resend rejected the API key (401).')
      console.error('Copy a fresh key from https://resend.com/api-keys into functions/.env as RESEND_API_KEY')
    } else if (response.status === 403 && fromEmail !== 'onboarding@resend.dev') {
      console.warn(`From address "${fromEmail}" may be unverified. Retrying with onboarding@resend.dev...`)
      const retry = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'Deccan Bawarchi Orders <onboarding@resend.dev>',
          to: [toEmail],
          subject,
          text,
        }),
      })
      const retryPayload = await retry.text()
      if (retry.ok) {
        console.log('Email sent successfully (via onboarding@resend.dev).')
        console.log('Resend response:', JSON.parse(retryPayload))
        return
      }
      console.error(`Retry failed (${retry.status}):`, retryPayload)
      process.exit(1)
    }
    console.error(`Resend failed (${response.status}):`, payload)
    process.exit(1)
  }

  let result
  try {
    result = JSON.parse(payload)
  } catch {
    result = payload
  }

  console.log('Email sent successfully.')
  console.log('Resend response:', result)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
