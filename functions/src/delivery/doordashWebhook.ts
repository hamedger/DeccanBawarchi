import * as functions from 'firebase-functions/v2'
import { db, FieldValue, GeoPoint, Timestamp } from '../db'
import { DD_STATUS_MAP } from './doordashShared'

interface WebhookEvent {
  external_delivery_id?: string
  event_name?: string
  dasher_location?: { lat?: number; lng?: number }
  tracking_url?: string
  support_reference?: string | number
  dropoff_time_estimated?: string
}

async function resolveOrderId(externalId: string): Promise<string | null> {
  if (externalId.startsWith('order_')) return externalId.slice(6)

  const byQuote = await db
    .collection('orders')
    .where('doordashQuoteId', '==', externalId)
    .limit(1)
    .get()
  if (!byQuote.empty) return byQuote.docs[0].id

  const byDelivery = await db
    .collection('orders')
    .where('doordashDeliveryId', '==', externalId)
    .limit(1)
    .get()
  if (!byDelivery.empty) return byDelivery.docs[0].id

  return null
}

function parseDropoffEstimated(iso: string | undefined): Timestamp | null {
  if (!iso) return null
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null
  return Timestamp.fromDate(date)
}

export const doordashWebhook = functions.https.onRequest(async (req, res) => {
  const event = req.body as WebhookEvent

  const externalId = String(event.external_delivery_id ?? '').trim()
  const ddStatus = String(event.event_name ?? '').trim()
  const lat = event.dasher_location?.lat
  const lng = event.dasher_location?.lng

  if (!externalId) {
    res.sendStatus(200)
    return
  }

  const orderId = await resolveOrderId(externalId)
  if (!orderId) {
    res.sendStatus(200)
    return
  }

  const newStatus = DD_STATUS_MAP[ddStatus] ?? DD_STATUS_MAP[ddStatus.toUpperCase()]
  const update: Record<string, unknown> = {
    updatedAt: FieldValue.serverTimestamp(),
  }

  if (newStatus) update.status = newStatus
  if (typeof lat === 'number' && typeof lng === 'number') {
    update.driverLocation = new GeoPoint(lat, lng)
  }
  if (event.tracking_url) update.doordashTrackingUrl = event.tracking_url
  if (event.support_reference != null && String(event.support_reference).trim()) {
    update.doordashSupportId = String(event.support_reference)
  }
  const dropoffEta = parseDropoffEstimated(event.dropoff_time_estimated)
  if (dropoffEta) update.estimatedDeliveryTime = dropoffEta

  await db.collection('orders').doc(orderId).update(update)
  res.sendStatus(200)
})
