import { collection, doc, serverTimestamp, setDoc } from 'firebase/firestore'
import { getFunctions, httpsCallable } from 'firebase/functions'
import app, { auth, db, isFirebaseConfigured } from '../firebase'
import { DEFAULT_LOCATION_ID } from '../../constants/config'
import { calculateEarnedPoints } from './loyaltyService'
import { FulfillmentType, OrderItem } from '../../types/order'
import { Address } from '../../types/user'

export interface SubmitOrderInput {
  items: OrderItem[]
  subtotal: number
  tax: number
  serviceFee: number
  deliveryFee: number
  tip: number
  total: number
  promoCode: string
  promoDiscount: number
  loyaltyPointsUsed: number
  giftCardAmount: number
  fulfillmentType: FulfillmentType
  deliveryAddress: Address | null
  notes: string
  locationId?: string
}

function buildOrderDoc(input: SubmitOrderInput, orderId: string, userId: string) {
  return {
    id: orderId,
    userId,
    guestEmail: '',
    guestPhone: '',
    locationId: input.locationId ?? DEFAULT_LOCATION_ID,
    items: input.items,
    subtotal: input.subtotal,
    tax: input.tax,
    deliveryFee: input.deliveryFee,
    serviceFee: input.serviceFee,
    tip: input.tip,
    promoCode: input.promoCode,
    promoDiscount: input.promoDiscount,
    loyaltyPointsUsed: input.loyaltyPointsUsed,
    loyaltyPointsEarned: calculateEarnedPoints(input.subtotal),
    loyaltyAwarded: false,
    giftCardAmount: input.giftCardAmount,
    total: input.total,
    fulfillmentType: input.fulfillmentType,
    scheduledFor: null,
    pickupTime: null,
    deliveryAddress: input.deliveryAddress,
    status: 'confirmed',
    stripePaymentIntentId: '',
    doordashDeliveryId: '',
    doordashTrackingUrl: '',
    driverLocation: null,
    estimatedDeliveryTime: null,
    notes: input.notes,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }
}

async function createOrderDirect(input: SubmitOrderInput): Promise<string> {
  const userId = auth.currentUser?.uid
  if (!userId) throw new Error('Must be signed in to place an order.')

  const orderRef = doc(collection(db, 'orders'))
  await setDoc(orderRef, buildOrderDoc(input, orderRef.id, userId))
  return orderRef.id
}

export async function submitOrder(input: SubmitOrderInput): Promise<string> {
  if (!isFirebaseConfigured) {
    throw new Error('Firebase is not configured.')
  }
  if (!auth.currentUser) {
    throw new Error('Must be signed in to place an order.')
  }

  try {
    const functions = getFunctions(app, 'us-central1')
    const createOrder = httpsCallable(functions, 'createOrder')
    const result = await createOrder({
      items: input.items,
      subtotal: input.subtotal,
      tax: input.tax,
      deliveryFee: input.deliveryFee,
      serviceFee: input.serviceFee,
      tip: input.tip,
      total: input.total,
      promoCode: input.promoCode,
      promoDiscount: input.promoDiscount,
      loyaltyPointsUsed: input.loyaltyPointsUsed,
      giftCardAmount: input.giftCardAmount,
      fulfillmentType: input.fulfillmentType,
      deliveryAddress: input.deliveryAddress,
      locationId: input.locationId ?? DEFAULT_LOCATION_ID,
      notes: input.notes,
    })
    return (result.data as { orderId: string }).orderId
  } catch (e) {
    if (input.loyaltyPointsUsed > 0) {
      const message = e instanceof Error ? e.message : 'Could not apply loyalty points.'
      throw new Error(message)
    }
    return createOrderDirect(input)
  }
}
