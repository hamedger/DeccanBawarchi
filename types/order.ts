import { Timestamp, GeoPoint } from 'firebase/firestore'
import { Address } from './user'

/** 'self' = in-house drivers. Anything else is a dispatched third-party courier. */
export type DeliveryProviderId = 'self' | 'doordash' | 'uber_direct'

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
  deliveryDistanceMiles?: number
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
  /** Which courier is fulfilling a delivery order. Undefined/absent means self-delivery. */
  deliveryProvider?: DeliveryProviderId
  /** Quote id from the active provider's quote call — consumed once at order creation. */
  deliveryExternalQuoteId?: string
  /** Id of the created/accepted delivery with the active provider. */
  deliveryExternalId?: string
  deliverySupportId?: string
  deliveryTrackingUrl?: string
  /** Set when dispatch to the provider fails after payment; staff can retry manually. */
  deliveryDispatchError?: string
  driverLocation?: GeoPoint | null
  estimatedDeliveryTime?: Timestamp | null
  notes: string
  /** 'clover_online' = imported from the Clover Online Ordering storefront; absent = placed in-app. */
  source?: 'clover_online'
  cloverOrderId?: string
  createdAt: Timestamp
  updatedAt: Timestamp
}
