import type { DeliveryProviderId } from '../types/order'

export const APP_NAME = 'Deccan Bawarchi'
export const APP_TAGLINE = 'Authentic Hyderabadi Cuisine'
export const RESTAURANT_PHONE = '+19472868794'
export const RESTAURANT_ADDRESS = '24234 Orchard Lake Rd, Farmington Hills, MI 48336'
export const RESTAURANT_WEBSITE = 'https://www.bawarchi.io'
export const SUPPORT_EMAIL = 'support@deccanbawarchi.com'
export const ORDERS_EMAIL = 'orders@deccanbawarchi.com'
/** Staff inbox for new paid order alerts (Cloud Functions). */
export const ORDERS_NOTIFICATION_EMAIL = 'mjalaluddin63@gmail.com'

export const DEFAULT_LOCATION_ID = 'farmington-hills-mi'

type HourRange = { open: string; close: string }

/** Per-location dine-in hours (24h HH:mm), open daily. */
export const LOCATION_DINE_IN_HOURS: Record<string, HourRange> = {
  'northville-mi': { open: '11:30', close: '22:00' },
  'farmington-hills-mi': { open: '11:30', close: '23:30' },
}

/** Build a 7-day hours map with the same open/close every day. */
export function buildWeeklyLocationHours(
  open: string,
  close: string,
): Record<number, HourRange> {
  return Object.fromEntries(
    Array.from({ length: 7 }, (_, day) => [day, { open, close }]),
  ) as Record<number, HourRange>
}

/** @deprecated Use per-location dine-in hours via `buildWeeklyLocationHours`. */
export const BUSINESS_HOURS = buildWeeklyLocationHours(
  LOCATION_DINE_IN_HOURS[DEFAULT_LOCATION_ID].open,
  LOCATION_DINE_IN_HOURS[DEFAULT_LOCATION_ID].close,
)

/** Per-location pickup/delivery hours (24h HH:mm). */
export const LOCATION_ORDER_FULFILLMENT_HOURS: Record<string, HourRange> = {
  'northville-mi': { open: '12:00', close: '22:00' },
  'farmington-hills-mi': { open: '12:00', close: '23:30' },
}

/** Max distance self-delivery drivers will travel; beyond this, delivery is declined. */
export const MAX_DELIVERY_RADIUS_MILES = 5
/** Delivery is free up to this distance from the ordering location. */
export const FREE_DELIVERY_RADIUS_MILES = 1
export const DELIVERY_RATE_CENTS_PER_MILE = 100
export const DELIVERY_MINIMUM_SUBTOTAL_CENTS = 2000
/** Fixed daily delivery window (self-delivery drivers), same at every location. */
export const DELIVERY_FULFILLMENT_HOURS = { open: '17:00', close: '23:30' }

/**
 * Delivery UI + checkout flow (self-delivery or a dispatched courier — see ACTIVE_DELIVERY_PROVIDER).
 * Off by default in production; set EXPO_PUBLIC_DELIVERY_ENABLED=true in .env for local/staging tests.
 */
export const DELIVERY_ENABLED = process.env.EXPO_PUBLIC_DELIVERY_ENABLED === 'true'

/**
 * Which courier actually fulfills delivery orders. Exactly one provider is active at a time —
 * this is not a per-order customer choice. Defaults to in-house self-delivery everywhere it
 * isn't explicitly overridden. The client doesn't branch on this (the deliveryQuote/checkout
 * flow is identical either way); it only matters server-side and for provider-specific copy.
 */
export const ACTIVE_DELIVERY_PROVIDER: DeliveryProviderId =
  (process.env.EXPO_PUBLIC_DELIVERY_PROVIDER as DeliveryProviderId) || 'self'

export const LOYALTY = {
  pointsPerDollar: 1,
  pointsToDollar: 100,
  bonus: {
    firstOrder: 100,
    birthday: 2,      // 2x multiplier
    referral: 200,
    review: 25,
    socialShare: 10,
  },
  tiers: {
    bronze: { min: 0, max: 499 },
    silver: { min: 500, max: 1499 },
    gold: { min: 1500, max: 2999 },
    platinum: { min: 3000, max: Infinity },
  },
}

export const DEFAULT_PICKUP_PREP_BUFFER_MINUTES = 30

export const TIMEZONE = 'America/Detroit'
