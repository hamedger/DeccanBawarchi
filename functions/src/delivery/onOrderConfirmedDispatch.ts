import { FieldValue } from '../db'
import { onDocumentUpdated } from 'firebase-functions/v2/firestore'
import { dispatchOrderToDoorDash } from './doordashDispatch'

export const onOrderConfirmedDispatch = onDocumentUpdated('orders/{orderId}', async (event) => {
  const before = event.data?.before.data()
  const after = event.data?.after.data()
  const orderId = event.params.orderId

  if (!after || !orderId) return

  const becamePlaced = before?.status !== 'placed' && after.status === 'placed'
  const isDelivery = after.fulfillmentType === 'delivery'
  const hasDelivery = String(after.doordashDeliveryId ?? '').trim().length > 0

  if (!becamePlaced || !isDelivery || hasDelivery) return

  try {
    await dispatchOrderToDoorDash(orderId)
  } catch (error) {
    await event.data?.after.ref.update({
      doordashDispatchError:
        error instanceof Error ? error.message : 'Unknown dispatch error',
      updatedAt: FieldValue.serverTimestamp(),
    })
  }
})
