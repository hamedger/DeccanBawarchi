import { db } from '../db'

export interface AddressComponents {
  street: string
  city: string
  state: string
  zip: string
}

export interface DeliveryPickupLocation {
  locationId: string
  pickupAddress: string
  pickupAddressComponents: AddressComponents
  pickupBusinessName: string
  pickupPhone: string
  prepBufferMinutes: number
  timezone: string
}

/** Mirrors constants/staticLocations.ts — used only if the Firestore locations doc is missing. */
const FALLBACK_LOCATIONS: Record<string, DeliveryPickupLocation> = {
  'northville-mi': {
    locationId: 'northville-mi',
    pickupAddress: '17933 Haggerty Rd, Township of Northville, MI 48168',
    pickupAddressComponents: {
      street: '17933 Haggerty Rd',
      city: 'Township of Northville',
      state: 'MI',
      zip: '48168',
    },
    pickupBusinessName: 'Deccan Bawarchi — Northville',
    pickupPhone: '+12489857209',
    prepBufferMinutes: 30,
    timezone: 'America/Detroit',
  },
  'farmington-hills-mi': {
    locationId: 'farmington-hills-mi',
    pickupAddress: '24234 Orchard Lake Rd, Farmington Hills, MI 48336',
    pickupAddressComponents: {
      street: '24234 Orchard Lake Rd',
      city: 'Farmington Hills',
      state: 'MI',
      zip: '48336',
    },
    pickupBusinessName: 'Deccan Bawarchi — Farmington Hills',
    pickupPhone: '+19472868794',
    prepBufferMinutes: 30,
    timezone: 'America/Detroit',
  },
}

function formatAddress(address: {
  street?: string
  city?: string
  state?: string
  zip?: string
}): string {
  return `${address.street ?? ''}, ${address.city ?? ''}, ${address.state ?? ''} ${address.zip ?? ''}`
    .replace(/\s+/g, ' ')
    .trim()
}

/** Live per-location pickup details for a dispatched delivery — reads the same `locations`
 * collection the admin panel edits, so a phone/address change there stays in sync automatically. */
export async function resolveDeliveryLocation(locationId: string): Promise<DeliveryPickupLocation> {
  const id = locationId?.trim() || 'northville-mi'
  const fallback = FALLBACK_LOCATIONS[id] ?? FALLBACK_LOCATIONS['northville-mi']

  try {
    const snap = await db.collection('locations').doc(id).get()
    if (!snap.exists) return fallback
    const data = snap.data()!
    const components: AddressComponents = data.address
      ? {
          street: String(data.address.street ?? fallback.pickupAddressComponents.street),
          city: String(data.address.city ?? fallback.pickupAddressComponents.city),
          state: String(data.address.state ?? fallback.pickupAddressComponents.state),
          zip: String(data.address.zip ?? fallback.pickupAddressComponents.zip),
        }
      : fallback.pickupAddressComponents
    return {
      locationId: id,
      pickupAddress: data.address ? formatAddress(data.address) : fallback.pickupAddress,
      pickupAddressComponents: components,
      pickupBusinessName: String(data.name ?? fallback.pickupBusinessName),
      pickupPhone: String(data.phone ?? fallback.pickupPhone),
      prepBufferMinutes: Number(data.pickupPrepBufferMinutes ?? fallback.prepBufferMinutes),
      timezone: String(data.timezone ?? fallback.timezone),
    }
  } catch {
    return fallback
  }
}
