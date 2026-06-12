import { create } from 'zustand'
import { FulfillmentType, Order, OrderItem } from '../types/order'
import { DELIVERY_ENABLED } from '../constants/config'
import {
  MOCK_DELIVERY_FEE_CENTS,
  MOCK_DELIVERY_ETA_MINUTES,
  MOCK_PICKUP_ETA_MINUTES,
} from '../constants/checkout'
import { getDefaultPickupDate, PICKUP_ASAP } from '../lib/services/pickupScheduling'

interface CartState {
  items: OrderItem[]
  fulfillmentType: FulfillmentType
  deliveryFee: number
  deliveryEtaMinutes: number
  pickupDate: string
  pickupTime: string
  promoCode: string
  promoDiscount: number
  loyaltyPointsToRedeem: number
  giftCardCode: string
  giftCardAmount: number
  tip: number
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
  setNotes: (notes: string) => void
  setFulfillmentType: (type: FulfillmentType) => void
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
  deliveryFee: DELIVERY_ENABLED ? MOCK_DELIVERY_FEE_CENTS : 0,
  deliveryEtaMinutes: DELIVERY_ENABLED ? MOCK_DELIVERY_ETA_MINUTES : MOCK_PICKUP_ETA_MINUTES,
  pickupDate: getDefaultPickupDate(),
  pickupTime: PICKUP_ASAP,
  promoCode: '',
  promoDiscount: 0,
  loyaltyPointsToRedeem: 0,
  giftCardCode: '',
  giftCardAmount: 0,
  tip: 0,
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
  setTip: (tip) => set({ tip }),
  setNotes: (notes) => set({ notes }),

  setFulfillmentType: (type) => {
    if (type === 'delivery' && !DELIVERY_ENABLED) return
    set({
      fulfillmentType: type,
      deliveryFee: type === 'delivery' ? MOCK_DELIVERY_FEE_CENTS : 0,
      deliveryEtaMinutes: type === 'delivery' ? MOCK_DELIVERY_ETA_MINUTES : MOCK_PICKUP_ETA_MINUTES,
      ...(type === 'pickup'
        ? { pickupDate: getDefaultPickupDate(), pickupTime: PICKUP_ASAP }
        : {}),
    })
  },

  setPickupDate: (date) => set({ pickupDate: date }),
  setPickupTime: (time) => set({ pickupTime: time }),

  clearCart: () =>
    set({
      items: [],
      fulfillmentType: DELIVERY_ENABLED ? 'delivery' : 'pickup',
      deliveryFee: DELIVERY_ENABLED ? MOCK_DELIVERY_FEE_CENTS : 0,
      deliveryEtaMinutes: DELIVERY_ENABLED ? MOCK_DELIVERY_ETA_MINUTES : MOCK_PICKUP_ETA_MINUTES,
      pickupDate: getDefaultPickupDate(),
      pickupTime: PICKUP_ASAP,
      promoCode: '',
      promoDiscount: 0,
      loyaltyPointsToRedeem: 0,
      giftCardCode: '',
      giftCardAmount: 0,
      tip: 0,
      notes: '',
    }),

  loadFromOrder: (order) => {
    const fulfillmentType =
      order.fulfillmentType === 'delivery' && !DELIVERY_ENABLED ? 'pickup' : order.fulfillmentType
    set({
      items: order.items.map((item) => ({ ...item })),
      fulfillmentType,
      deliveryFee: fulfillmentType === 'delivery' ? MOCK_DELIVERY_FEE_CENTS : 0,
      deliveryEtaMinutes:
        fulfillmentType === 'delivery' ? MOCK_DELIVERY_ETA_MINUTES : MOCK_PICKUP_ETA_MINUTES,
      pickupDate: getDefaultPickupDate(),
      pickupTime: PICKUP_ASAP,
      promoCode: '',
      promoDiscount: 0,
      loyaltyPointsToRedeem: 0,
      giftCardCode: '',
      giftCardAmount: 0,
      tip: order.tip ?? 0,
      notes: order.notes ?? '',
    })
  },

  subtotal: () => get().items.reduce((sum, i) => sum + i.price * i.quantity, 0),
  itemCount: () => get().items.reduce((sum, i) => sum + i.quantity, 0),
}))
