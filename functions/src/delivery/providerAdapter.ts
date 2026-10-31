export type DeliveryProviderId = 'doordash' | 'uber_direct'

export interface DeliveryQuoteItemInput {
  name: string
  quantity: number
  price: number
}

export interface DeliveryQuoteInput {
  locationId: string
  dropoffStreet: string
  dropoffCity: string
  dropoffState: string
  dropoffZip: string
  dropoffUnit?: string
  dropoffPhoneNumber: string
  dropoffContactGivenName: string
  orderValue: number
  items: DeliveryQuoteItemInput[]
  pickupTime?: string
}

export interface DeliveryQuoteResult {
  feeCents: number
  etaMinutes: number
  externalQuoteId: string
}

export interface DeliveryDispatchResult {
  externalId: string
  trackingUrl: string
  supportId?: string
}

/** Normalized shape every provider's webhook payload gets mapped into. */
export interface DeliveryWebhookEvent {
  /** externalQuoteId or externalId to look the order up by — provider payloads reference either. */
  lookupKey: string
  status?: string
  driverLocation?: { lat: number; lng: number }
  trackingUrl?: string
  supportId?: string
  estimatedDeliveryIso?: string
}

export interface DeliveryProviderAdapter {
  id: DeliveryProviderId
  getQuote(input: DeliveryQuoteInput): Promise<DeliveryQuoteResult>
  dispatch(orderId: string, order: Record<string, unknown>): Promise<DeliveryDispatchResult>
  cancel(externalId: string): Promise<void>
  mapWebhookEvent(payload: unknown): DeliveryWebhookEvent | null
}
