import { Timestamp, GeoPoint } from 'firebase/firestore'
import { Address } from './user'

export type OrderStatus =
  | 'pending'
  | 'placed'
  | 'confirmed'
  | 'preparing'
  | 'ready'
  | 'picked_up'
  | 'delivered'
  | 'cancelled'

export type FulfillmentType = 'delivery' | 'pickup'

export interface OrderItem {
  menuItemId: string
  name: string
  price: number
  quantity: number
  instructions?: string
  imageURL?: string
}

export interface Order {
  id: string
  userId: string | 'guest'
  guestName?: string
  guestEmail: string
  guestPhone: string
  locationId: string
  items: OrderItem[]
  subtotal: number
  tax: number
  deliveryFee: number
  serviceFee: number
  tip: number
  promoCode: string
  promoDiscount: number
  loyaltyPointsUsed: number
  loyaltyPointsEarned: number
  loyaltyAwarded?: boolean
  giftCardAmount: number
  total: number
  fulfillmentType: FulfillmentType
  scheduledFor: Timestamp | null
  pickupTime: Timestamp | null
  deliveryAddress: Address
  status: OrderStatus
  stripePaymentIntentId: string
  cloverMerchantId?: string
  cloverCheckoutSessionId?: string
  cloverPaymentId?: string
  doordashDeliveryId: string
  doordashTrackingUrl: string
  driverLocation: GeoPoint | null
  estimatedDeliveryTime: Timestamp
  notes: string
  createdAt: Timestamp
  updatedAt: Timestamp
}
