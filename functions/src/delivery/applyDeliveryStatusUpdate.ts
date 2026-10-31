import { db, FieldValue, GeoPoint, Timestamp } from '../db'
import { DeliveryWebhookEvent } from './providerAdapter'

async function findOrderIdByLookupKey(lookupKey: string): Promise<string | null> {
  const byQuote = await db
    .collection('orders')
    .where('deliveryExternalQuoteId', '==', lookupKey)
    .limit(1)
    .get()
  if (!byQuote.empty) return byQuote.docs[0].id

  const byDelivery = await db
    .collection('orders')
    .where('deliveryExternalId', '==', lookupKey)
    .limit(1)
    .get()
  if (!byDelivery.empty) return byDelivery.docs[0].id

  return null
}

function parseIsoTimestamp(iso: string | undefined): Timestamp | null {
  if (!iso) return null
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null
  return Timestamp.fromDate(date)
}

/** Shared by every provider's webhook handler — writes the generic delivery fields onto the
 * order doc regardless of which courier sent the update. Existing status-driven triggers
 * (awardLoyaltyOnDelivery, notifyCustomerOnDelivered) key off `status` alone, so no changes
 * are needed there for this to work end to end. */
export async function applyDeliveryStatusUpdate(event: DeliveryWebhookEvent): Promise<void> {
  const orderId = await findOrderIdByLookupKey(event.lookupKey)
  if (!orderId) return

  const update: Record<string, unknown> = {
    updatedAt: FieldValue.serverTimestamp(),
  }

  if (event.status) update.status = event.status
  if (event.driverLocation) {
    update.driverLocation = new GeoPoint(event.driverLocation.lat, event.driverLocation.lng)
  }
  if (event.trackingUrl) update.deliveryTrackingUrl = event.trackingUrl
  if (event.supportId) update.deliverySupportId = event.supportId
  const estimatedDeliveryTime = parseIsoTimestamp(event.estimatedDeliveryIso)
  if (estimatedDeliveryTime) update.estimatedDeliveryTime = estimatedDeliveryTime

  await db.collection('orders').doc(orderId).update(update)
}
