import { addMinutes, parse, setHours, setMinutes } from 'date-fns'
import { fromZonedTime, toZonedTime } from 'date-fns-tz'
import { TIMEZONE } from '../constants/config'
import { PICKUP_ASAP } from './services/pickupScheduling'

export interface DropoffAddressInput {
  street: string
  city: string
  state: string
  zip: string
  country?: string
  unit?: string
  instructions?: string
}

export function toE164USPhone(phone: string): string | null {
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 10) return `+1${digits}`
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`
  return null
}

export function isValidUSPhone(phone: string): boolean {
  return toE164USPhone(phone) !== null
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

/** Convert scheduled pickup (Detroit local) to UTC ISO-8601 for DoorDash pickup_time. */
export function toPickupTimeIso(
  pickupDate: string | null | undefined,
  pickupTime: string | null | undefined,
  prepBufferMinutes: number,
  timezone: string = TIMEZONE,
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

export function formatPickupTimeDisplay(
  pickupDate: string | null | undefined,
  pickupTime: string | null | undefined,
): string | null {
  if (!pickupDate?.trim() || !pickupTime?.trim()) return null
  if (pickupTime === PICKUP_ASAP) return 'ASAP'
  return `${pickupDate} ${pickupTime}`
}
