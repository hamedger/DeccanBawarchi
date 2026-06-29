import {
  buildWeeklyLocationHours,
  DEFAULT_PICKUP_PREP_BUFFER_MINUTES,
  LOCATION_DINE_IN_HOURS,
  LOCATION_ORDER_FULFILLMENT_HOURS,
} from './config'
import { Location } from '../types/location'

export const STATIC_LOCATIONS: Location[] = [
  {
    id: 'northville-mi',
    name: 'Deccan Bawarchi — Northville',
    address: {
      street: '17933 Haggerty Rd',
      city: 'Township of Northville',
      state: 'MI',
      zip: '48168',
      country: 'US',
    },
    phone: '+12489857209',
    website: 'https://deccanbawarchi.com',
    hours: buildWeeklyLocationHours(
      LOCATION_DINE_IN_HOURS['northville-mi'].open,
      LOCATION_DINE_IN_HOURS['northville-mi'].close,
    ),
    fulfillmentHours: { ...LOCATION_ORDER_FULFILLMENT_HOURS['northville-mi'] },
    isActive: true,
    acceptsDelivery: true,
    acceptsPickup: true,
    acceptsReservations: true,
    acceptsCatering: true,
    deliveryRadius: 10,
    timezone: 'America/Detroit',
    pickupPrepBufferMinutes: DEFAULT_PICKUP_PREP_BUFFER_MINUTES,
  },
  {
    id: 'farmington-hills-mi',
    name: 'Deccan Bawarchi — Farmington Hills',
    address: {
      street: '24234 Orchard Lake Rd',
      city: 'Farmington Hills',
      state: 'MI',
      zip: '48336',
      country: 'US',
    },
    phone: '+19472868794',
    website: 'https://deccanbawarchi.com',
    hours: buildWeeklyLocationHours(
      LOCATION_DINE_IN_HOURS['farmington-hills-mi'].open,
      LOCATION_DINE_IN_HOURS['farmington-hills-mi'].close,
    ),
    fulfillmentHours: { ...LOCATION_ORDER_FULFILLMENT_HOURS['farmington-hills-mi'] },
    isActive: true,
    acceptsDelivery: true,
    acceptsPickup: true,
    acceptsReservations: true,
    acceptsCatering: true,
    deliveryRadius: 10,
    timezone: 'America/Detroit',
    pickupPrepBufferMinutes: DEFAULT_PICKUP_PREP_BUFFER_MINUTES,
  },
]

export const STATIC_LOCATION_IDS = STATIC_LOCATIONS.map((l) => l.id)
