export interface DeliveryQuoteItem {
  name: string
  quantity: number
  price: number
}

export interface DeliveryQuote {
  fee: number
  /** Only present for self-delivery (haversine distance). Dispatched couriers don't return this. */
  distanceMiles?: number
  etaMinutes: number
  currency: string
  /** Present when a dispatched courier handled the quote — pass through at checkout. */
  externalQuoteId?: string
}

export interface DeliveryQuoteRequest {
  dropoffStreet: string
  dropoffCity: string
  dropoffState?: string
  dropoffZip: string
  dropoffUnit?: string
  locationId: string
  /** Below are unused by self-delivery, required if a dispatched courier is active. */
  dropoffPhoneNumber?: string
  dropoffContactGivenName?: string
  orderValue?: number
  items?: DeliveryQuoteItem[]
  pickupTime?: string
}
