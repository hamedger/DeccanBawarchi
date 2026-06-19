export const APP_NAME = 'Deccan Bawarchi'
export const APP_TAGLINE = 'Authentic Hyderabadi Cuisine'
export const RESTAURANT_PHONE = '+12489857209'
export const RESTAURANT_ADDRESS = '17933 Haggerty Rd, Township of Northville, MI 48168'
export const RESTAURANT_WEBSITE = 'https://deccanbawarchi.com'
export const SUPPORT_EMAIL = 'support@deccanbawarchi.com'
export const ORDERS_EMAIL = 'orders@deccanbawarchi.com'

export const BUSINESS_HOURS = {
  // 0=Sun, 1=Mon ... 6=Sat — Open 7 days 11:30 AM – 1:00 AM
  0: { open: '11:30', close: '01:00' },
  1: { open: '11:30', close: '01:00' },
  2: { open: '11:30', close: '01:00' },
  3: { open: '11:30', close: '01:00' },
  4: { open: '11:30', close: '01:00' },
  5: { open: '11:30', close: '01:00' },
  6: { open: '11:30', close: '01:00' },
} as const

export const DELIVERY_RADIUS_MILES = 10

/** DoorDash Drive delivery — Phase 3. Pickup-only until local testing passes. */
export const DELIVERY_ENABLED = false

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

export const DEFAULT_LOCATION_ID = 'northville-mi'

export const TIMEZONE = 'America/Detroit'
