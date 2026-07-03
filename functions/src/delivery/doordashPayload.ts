import { addMinutes, parse, setHours, setMinutes } from 'date-fns'
import { fromZonedTime, toZonedTime } from 'date-fns-tz'
import { resolveRestaurantLocation } from './restaurantLocations'

const PICKUP_ASAP = 'asap'

export interface DropoffAddressInput {
  street: string
  city: string
  state: string
  zip: string
  country?: string
  unit?: string
  instructions?: string
}

export interface OrderItemInput {
  menuItemId: string
  name: string
  price: number
  quantity: number
  instructions?: string
}

export function toE164USPhone(phone: string): string | null {
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 10) return `+1${digits}`
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`
  return null
}

export function extractFirstName(displayName: string): string {
  const trimmed = displayName.trim()
  if (!trimmed) return 'Guest'
  return trimmed.split(/\s+/)[0]
}

export function formatDropoffAddress(addr: DropoffAddressInput): string {
  const street = addr.unit?.trim()
    ? `${addr.street.trim()}, ${addr.unit.trim()}`
    : addr.street.trim()
  return `${street}, ${addr.city.trim()}, ${addr.state.trim()} ${addr.zip.trim()}`
}

export function buildDropoffAddressComponents(addr: DropoffAddressInput) {
  const components: Record<string, string | number> = {
    street_address: addr.street.trim(),
    city: addr.city.trim(),
    state: addr.state.trim(),
    zip_code: addr.zip.trim(),
    country: addr.country?.trim() || 'US',
  }
  if (addr.unit?.trim()) {
    components.sub_premise = addr.unit.trim()
  }
  return components
}

function parsePickupSlotMinutes(timeValue: string): number | null {
  const trimmed = timeValue.trim()
  if (!trimmed || trimmed === PICKUP_ASAP) return null

  const presetParsed = parse(trimmed, 'h:mm a', new Date())
  if (!Number.isNaN(presetParsed.getTime())) {
    return presetParsed.getHours() * 60 + presetParsed.getMinutes()
  }

  const h24Parsed = parse(trimmed, 'HH:mm', new Date())
  if (!Number.isNaN(h24Parsed.getTime())) {
    return h24Parsed.getHours() * 60 + h24Parsed.getMinutes()
  }

  return null
}

export function toPickupTimeIso(
  pickupDate: string | null | undefined,
  pickupTime: string | null | undefined,
  prepBufferMinutes: number,
  timezone: string,
): string {
  const nowZoned = toZonedTime(new Date(), timezone)

  if (!pickupDate?.trim() || !pickupTime?.trim() || pickupTime === PICKUP_ASAP) {
    return addMinutes(nowZoned, prepBufferMinutes).toISOString()
  }

  const slotMinutes = parsePickupSlotMinutes(pickupTime)
  if (slotMinutes === null) {
    return addMinutes(nowZoned, prepBufferMinutes).toISOString()
  }

  const date = parse(pickupDate.trim(), 'yyyy-MM-dd', nowZoned)
  const hours = Math.floor(slotMinutes / 60)
  const minutes = slotMinutes % 60
  const localPickup = setMinutes(setHours(date, hours), minutes)
  return fromZonedTime(localPickup, timezone).toISOString()
}

export function buildDoorDashItems(items: OrderItemInput[]) {
  return items.map((item) => ({
    name: item.name,
    quantity: item.quantity,
    external_id: item.menuItemId,
    price: item.price,
    ...(item.instructions?.trim() ? { special_instructions: item.instructions.trim() } : {}),
  }))
}

export interface DoorDashDeliveryPayloadInput {
  externalDeliveryId: string
  locationId?: string | null
  dropoffAddress: DropoffAddressInput
  dropoffPhoneNumber: string
  dropoffContactGivenName: string
  orderValue: number
  tip?: number
  pickupDate?: string | null
  pickupTime?: string | null
  orderId?: string
  items?: OrderItemInput[]
}

export function buildDoorDashDeliveryPayload(input: DoorDashDeliveryPayloadInput) {
  const location = resolveRestaurantLocation(input.locationId)
  const dropoffPhone = toE164USPhone(input.dropoffPhoneNumber)
  if (!dropoffPhone) {
    throw new Error('Invalid dropoff phone number')
  }

  const pickupTimeIso = toPickupTimeIso(
    input.pickupDate,
    input.pickupTime,
    location.prepBufferMinutes,
    location.timezone,
  )

  const payload: Record<string, unknown> = {
    external_delivery_id: input.externalDeliveryId,
    pickup_address: location.pickupAddress,
    pickup_business_name: location.name,
    pickup_phone_number: location.pickupPhone,
    pickup_time: pickupTimeIso,
    dropoff_address: formatDropoffAddress(input.dropoffAddress),
    dropoff_address_components: buildDropoffAddressComponents(input.dropoffAddress),
    dropoff_phone_number: dropoffPhone,
    dropoff_contact_given_name: extractFirstName(input.dropoffContactGivenName),
    order_value: input.orderValue,
  }

  if (input.tip != null && input.tip > 0) {
    payload.tip = input.tip
  }

  if (input.orderId) {
    payload.pickup_instructions = `Order #${input.orderId.slice(-6).toUpperCase()}`
  }

  const instructions = input.dropoffAddress.instructions?.trim()
  if (instructions) {
    payload.dropoff_instructions = instructions
  }

  if (input.items?.length) {
    payload.items = buildDoorDashItems(input.items)
  }

  return { payload, pickupTimeIso, location }
}

export function resolveDoorDashSupportId(result: Record<string, unknown>, fallback: string): string {
  const candidates = [result.delivery_id, result.support_reference, result.id, result.external_delivery_id]
  for (const value of candidates) {
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return fallback
}
