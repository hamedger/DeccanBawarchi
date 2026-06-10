import * as functions from 'firebase-functions/v2'
import * as admin from 'firebase-admin'

const db = admin.firestore()

const DD_STATUS_MAP: Record<string, string> = {
  dasher_confirmed: 'confirmed',
  dasher_arrived_at_pickup: 'preparing',
  pickup_complete: 'picked_up',
  delivered: 'delivered',
  delivery_cancelled: 'cancelled',
}

export const doordashWebhook = functions.https.onRequest(async (req, res) => {
  const event = req.body

  const externalId: string = event.external_delivery_id ?? ''
  const ddStatus: string = event.event_name ?? ''
  const lat: number | undefined = event.dasher_location?.lat
  const lng: number | undefined = event.dasher_location?.lng

  // Derive our orderId from external_delivery_id format "order_<orderId>"
  const orderId = externalId.startsWith('order_') ? externalId.slice(6) : null
  if (!orderId) { res.sendStatus(200); return }

  const newStatus = DD_STATUS_MAP[ddStatus]
  const update: Record<string, any> = {
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }

  if (newStatus) update.status = newStatus
  if (lat && lng) update.driverLocation = new admin.firestore.GeoPoint(lat, lng)

  await db.collection('orders').doc(orderId).update(update)
  res.sendStatus(200)
})
