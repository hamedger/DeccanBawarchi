export interface DeliveryQuote {
  fee: number
  etaMinutes: number
  currency: string
  externalDeliveryId: string
}

export interface DeliveryQuoteItem {
  name: string
  quantity: number
  price: number
}

export interface DeliveryQuoteRequest {
  /** @deprecated Legacy single-line address; prefer structured dropoff* fields */
  dropoffAddress?: string
  dropoffStreet: string
  dropoffCity: string
  dropoffState?: string
  dropoffZip: string
  dropoffCountry?: string
  dropoffUnit?: string
  orderValue: number
  dropoffPhoneNumber?: string
  dropoffContactGivenName?: string
  pickupTime?: string
  items?: DeliveryQuoteItem[]
}

export interface DriverLocation {
  lat: number
  lng: number
  updatedAt: number
}
