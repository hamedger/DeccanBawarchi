import { onDocumentUpdated } from 'firebase-functions/v2/firestore'
import { FieldValue } from '../db'
import { orderPaymentJustRecorded } from '../orders/orderPayment'
import { getAdapterForProvider } from './activeProvider'
import { DeliveryProviderId } from './providerAdapter'
import { doordashSecrets } from './doordashConfig'
import { uberDirectSecrets } from './uberDirectConfig'

function isDispatchedProvider(value: unknown): value is DeliveryProviderId {
  return value === 'doordash' || value === 'uber_direct'
}

/** Fires once, right after payment confirms, for orders being fulfilled by a dispatched
 * courier (deliveryProvider set at checkout to whichever provider was active then — not
 * re-read from current config, so an order started under one provider always dispatches
 * to that same provider even if the active provider changes mid-flight). */
export const dispatchOnPlaced = onDocumentUpdated(
  { document: 'orders/{orderId}', secrets: [...doordashSecrets, ...uberDirectSecrets] },
  async (event) => {
    const before = event.data?.before.data()
    const after = event.data?.after.data()
    if (!after) return

    if (!orderPaymentJustRecorded(before, after)) return
    if (!isDispatchedProvider(after.deliveryProvider)) return
    if (after.fulfillmentType !== 'delivery') return
    if (String(after.deliveryExternalId ?? '').trim()) return

    const orderId = event.params.orderId
    const orderRef = event.data!.after.ref
    const adapter = getAdapterForProvider(after.deliveryProvider)

    try {
      const result = await adapter.dispatch(orderId, after)
      await orderRef.update({
        deliveryExternalId: result.externalId,
        deliveryTrackingUrl: result.trackingUrl,
        ...(result.supportId ? { deliverySupportId: result.supportId } : {}),
        deliveryDispatchError: FieldValue.delete(),
        updatedAt: FieldValue.serverTimestamp(),
      })
    } catch (error) {
      await orderRef.update({
        deliveryDispatchError: error instanceof Error ? error.message : 'Unknown dispatch error',
        updatedAt: FieldValue.serverTimestamp(),
      })
    }
  },
)
