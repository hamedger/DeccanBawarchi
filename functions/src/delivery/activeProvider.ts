import { defineString } from 'firebase-functions/params'
import { DeliveryProviderAdapter, DeliveryProviderId } from './providerAdapter'
import { doordashAdapter } from './doordashAdapter'
import { uberDirectAdapter } from './uberDirectAdapter'

/** Mirrors constants/config.ts's ACTIVE_DELIVERY_PROVIDER on the client. Exactly one provider
 * is active at a time — this is not a per-order customer choice. */
export const deliveryProviderParam = defineString('DELIVERY_PROVIDER', { default: 'self' })

export function getActiveProviderId(): 'self' | DeliveryProviderId {
  const value = deliveryProviderParam.value().trim()
  return value === 'doordash' || value === 'uber_direct' ? value : 'self'
}

export function getActiveProviderAdapter(): DeliveryProviderAdapter | null {
  switch (getActiveProviderId()) {
    case 'doordash':
      return doordashAdapter
    case 'uber_direct':
      return uberDirectAdapter
    default:
      return null
  }
}

export function getAdapterForProvider(id: DeliveryProviderId): DeliveryProviderAdapter {
  return id === 'doordash' ? doordashAdapter : uberDirectAdapter
}
