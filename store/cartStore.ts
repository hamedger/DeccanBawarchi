import { create } from 'zustand'
import { FulfillmentType, Order, OrderItem } from '../types/order'
import { DELIVERY_ENABLED } from '../constants/config'
import {
  MOCK_DELIVERY_ETA_MINUTES,
  MOCK_PICKUP_ETA_MINUTES,
} from '../constants/checkout'
import { getDefaultPickupDate, PICKUP_ASAP } from '../lib/services/pickupScheduling'
import { calculateTipFromPercent } from '../lib/services/cartService'

interface CartState {
  items: OrderItem[]
  fulfillmentType: FulfillmentType
  deliveryFee: number
  deliveryEtaMinutes: number
  deliveryQuoteReady: boolean
  externalDeliveryId: string | null
  pickupDate: string
  pickupTime: string
  promoCode: string
  promoDiscount: number
  loyaltyPointsToRedeem: number
  giftCardCode: string
  giftCardAmount: number
  tip: number
  tipPercent: number | null
  notes: string

  addItem: (item: Omit<OrderItem, 'quantity'>) => void
  removeItem: (menuItemId: string) => void
  updateQuantity: (menuItemId: string, quantity: number) => void
  updateInstructions: (menuItemId: string, instructions: string) => void
  setPromoCode: (code: string, discount: number) => void
  clearPromo: () => void
  setLoyaltyPoints: (points: number) => void
  setGiftCard: (code: string, amount: number) => void
  setTip: (tip: number) => void
  setTipPercent: (percent: number | null) => void
  setNotes: (notes: string) => void
  setFulfillmentType: (type: FulfillmentType) => void
  setDeliveryQuote: (quote: { fee: number; etaMinutes: number; externalDeliveryId: string }) => void
  clearDeliveryQuote: () => void
  setPickupDate: (date: string) => void
  setPickupTime: (time: string) => void
  clearCart: () => void
  loadFromOrder: (order: Order) => void

  subtotal: () => number
  itemCount: () => number
}

export const useCartStore = create<CartState>((set, get) => ({
  items: [],
  fulfillmentType: DELIVERY_ENABLED ? 'delivery' : 'pickup',
  deliveryFee: 0,
  deliveryEtaMinutes: DELIVERY_ENABLED ? MOCK_DELIVERY_ETA_MINUTES : MOCK_PICKUP_ETA_MINUTES,
  deliveryQuoteReady: false,
  externalDeliveryId: null,
  pickupDate: getDefaultPickupDate(),
  pickupTime: PICKUP_ASAP,
  promoCode: '',
  promoDiscount: 0,
  loyaltyPointsToRedeem: 0,
  giftCardCode: '',
  giftCardAmount: 0,
  tip: 0,
  tipPercent: null,
  notes: '',

  addItem: (item) => {
    set((state) => {
      const existing = state.items.find((i) => i.menuItemId === item.menuItemId)
      if (existing) {
        return {
          items: state.items.map((i) =>
            i.menuItemId === item.menuItemId ? { ...i, quantity: i.quantity + 1 } : i,
          ),
        }
      }
      return { items: [...state.items, { ...item, quantity: 1 }] }
    })
  },

  removeItem: (menuItemId) => {
    set((state) => ({ items: state.items.filter((i) => i.menuItemId !== menuItemId) }))
  },

  updateQuantity: (menuItemId, quantity) => {
    if (quantity <= 0) {
      get().removeItem(menuItemId)
      return
    }
    set((state) => ({
      items: state.items.map((i) => (i.menuItemId === menuItemId ? { ...i, quantity } : i)),
    }))
  },

  updateInstructions: (menuItemId, instructions) => {
    set((state) => ({
      items: state.items.map((i) =>
        i.menuItemId === menuItemId ? { ...i, instructions } : i,
      ),
    }))
  },

  setPromoCode: (code, discount) => set({ promoCode: code, promoDiscount: discount }),
  clearPromo: () => set({ promoCode: '', promoDiscount: 0 }),
  setLoyaltyPoints: (points) => set({ loyaltyPointsToRedeem: points }),
  setGiftCard: (code, amount) => set({ giftCardCode: code, giftCardAmount: amount }),
  setTip: (tip) => set({ tip, tipPercent: null }),
  setTipPercent: (percent) => {
    const subtotal = get().subtotal()
    set({
      tipPercent: percent,
      tip: percent != null ? calculateTipFromPercent(subtotal, percent) : 0,
    })
  },
  setNotes: (notes) => set({ notes }),

  setFulfillmentType: (type) => {
    if (type === 'delivery' && !DELIVERY_ENABLED) return
    set({
      fulfillmentType: type,
      deliveryFee: 0,
      deliveryEtaMinutes: type === 'delivery' ? MOCK_DELIVERY_ETA_MINUTES : MOCK_PICKUP_ETA_MINUTES,
      deliveryQuoteReady: false,
      externalDeliveryId: null,
      pickupDate: getDefaultPickupDate(),
      pickupTime: PICKUP_ASAP,
    })
  },

  setDeliveryQuote: (quote) =>
    set({
      deliveryFee: quote.fee,
      deliveryEtaMinutes: quote.etaMinutes,
      deliveryQuoteReady: true,
      externalDeliveryId: quote.externalDeliveryId,
    }),

  clearDeliveryQuote: () =>
    set({
      deliveryFee: 0,
      deliveryQuoteReady: false,
      externalDeliveryId: null,
    }),

  setPickupDate: (date) => set({ pickupDate: date }),
  setPickupTime: (time) => set({ pickupTime: time }),

  clearCart: () =>
    set({
      items: [],
      fulfillmentType: DELIVERY_ENABLED ? 'delivery' : 'pickup',
      deliveryFee: 0,
      deliveryEtaMinutes: DELIVERY_ENABLED ? MOCK_DELIVERY_ETA_MINUTES : MOCK_PICKUP_ETA_MINUTES,
      deliveryQuoteReady: false,
      externalDeliveryId: null,
      pickupDate: getDefaultPickupDate(),
      pickupTime: PICKUP_ASAP,
      promoCode: '',
      promoDiscount: 0,
      loyaltyPointsToRedeem: 0,
      giftCardCode: '',
      giftCardAmount: 0,
      tip: 0,
      tipPercent: null,
      notes: '',
    }),

  loadFromOrder: (order) => {
    const fulfillmentType =
      order.fulfillmentType === 'delivery' && !DELIVERY_ENABLED ? 'pickup' : order.fulfillmentType
    set({
      items: order.items.map((item) => ({ ...item })),
      fulfillmentType,
      deliveryFee: fulfillmentType === 'delivery' ? order.deliveryFee : 0,
      deliveryEtaMinutes:
        fulfillmentType === 'delivery'
          ? MOCK_DELIVERY_ETA_MINUTES
          : MOCK_PICKUP_ETA_MINUTES,
      deliveryQuoteReady: fulfillmentType === 'delivery' && order.deliveryFee > 0,
      externalDeliveryId: null,
      pickupDate: getDefaultPickupDate(),
      pickupTime: PICKUP_ASAP,
      promoCode: '',
      promoDiscount: 0,
      loyaltyPointsToRedeem: 0,
      giftCardCode: '',
      giftCardAmount: 0,
      tip: order.tip ?? 0,
      tipPercent: null,
      notes: order.notes ?? '',
    })
  },

  subtotal: () => get().items.reduce((sum, i) => sum + i.price * i.quantity, 0),
  itemCount: () => get().items.reduce((sum, i) => sum + i.quantity, 0),
}))
