export interface LocationAddress {
  street: string
  city: string
  state: string
  zip: string
  country: string
}

export interface LocationHours {
  open: string
  close: string
}

export interface Location {
  id: string
  name: string
  address: LocationAddress
  phone: string
  website?: string
  hours: Record<number, LocationHours>
  isActive: boolean
  acceptsDelivery: boolean
  acceptsPickup: boolean
  acceptsReservations: boolean
  acceptsCatering: boolean
  deliveryRadius: number
  timezone: string
  /** Minutes before earliest same-day pickup slot (ASAP still uses checkout ETA). */
  pickupPrepBufferMinutes?: number
}

export type LocationInput = Partial<Omit<Location, 'id' | 'address'>> & {
  id?: string
  address?: Partial<LocationAddress>
}
