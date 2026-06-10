export interface DeliveryQuote {
  fee: number
  etaMinutes: number
  currency: string
  externalDeliveryId: string
}

export interface DeliveryDispatchRequest {
  orderId: string
  pickupAddress: string
  dropoffAddress: string
  pickupPhoneNumber: string
  dropoffPhoneNumber: string
  dropoffContactGivenName: string
  orderValue: number
}

export interface DriverLocation {
  lat: number
  lng: number
  updatedAt: number
}
