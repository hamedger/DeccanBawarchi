import { db } from './firebase'

const QUOTE_TTL_MS = 20 * 60 * 1000

export type DeliveryProviderId = 'doordash' | 'uber_direct'

/**
 * Verifies a dispatched-courier delivery fee against the record the deliveryQuote Cloud
 * Function wrote when it actually called the provider — the client can never make up its
 * own deliveryFee for a DoorDash/Uber order, mirroring the self-delivery haversine
 * recheck this function replaces for those orders. Single-use: deletes the record on success
 * so the same quote can't be replayed onto a second order.
 */
export async function verifyDispatchedDeliveryQuote(input: {
  provider: DeliveryProviderId
  externalQuoteId: string
  locationId: string
  deliveryFeeCents: number
}): Promise<void> {
  const ref = db.collection('deliveryQuotes').doc(input.externalQuoteId)
  const snap = await ref.get()

  if (!snap.exists) {
    throw new Error('Delivery quote not found. Please refresh your delivery quote.')
  }

  const quote = snap.data()!
  const createdAt = quote.createdAt?.toDate?.() ?? null
  const ageMs = createdAt ? Date.now() - createdAt.getTime() : Infinity

  if (ageMs > QUOTE_TTL_MS) {
    await ref.delete()
    throw new Error('Delivery quote expired. Please refresh your delivery quote.')
  }
  if (quote.provider !== input.provider) {
    throw new Error('Delivery quote does not match the active delivery provider.')
  }
  if (String(quote.locationId ?? '') !== input.locationId) {
    throw new Error('Delivery quote does not match this location. Please refresh your delivery quote.')
  }
  if (Number(quote.feeCents) !== input.deliveryFeeCents) {
    throw new Error('Delivery fee does not match server calculation. Please refresh your delivery quote.')
  }

  await ref.delete()
}
