import * as functions from 'firebase-functions/v2'
import fetch, { Response } from 'node-fetch'
import { buildDoorDashJwt } from './doordashJwt'
import { DeliveryQuoteInput } from './providerAdapter'

export const DOORDASH_BASE = 'https://openapi.doordash.com'

export interface DropoffAddressComponents {
  street_address: string
  city: string
  state: string
  zip_code: string
  country: string
  sub_premise?: string
}

export function buildDropoffAddressComponents(input: DeliveryQuoteInput): DropoffAddressComponents {
  const components: DropoffAddressComponents = {
    street_address: input.dropoffStreet.trim(),
    city: input.dropoffCity.trim(),
    state: input.dropoffState.trim(),
    zip_code: input.dropoffZip.trim(),
    country: 'US',
  }
  if (input.dropoffUnit?.trim()) {
    components.sub_premise = input.dropoffUnit.trim()
  }
  return components
}

export function formatDropoffAddress(input: DeliveryQuoteInput): string {
  const street = input.dropoffUnit?.trim()
    ? `${input.dropoffStreet.trim()}, ${input.dropoffUnit.trim()}`
    : input.dropoffStreet.trim()
  return `${street}, ${input.dropoffCity.trim()}, ${input.dropoffState.trim()} ${input.dropoffZip.trim()}`
}

export function normalizeUsPhone(phone: string): string {
  const trimmed = phone.trim()
  if (!trimmed) return ''
  if (trimmed.startsWith('+')) {
    const digits = trimmed.replace(/\D/g, '')
    return digits ? `+${digits}` : ''
  }
  const digits = trimmed.replace(/\D/g, '')
  if (digits.length === 10) return `+1${digits}`
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`
  return trimmed
}

export function isValidUsPhone(phone: string): boolean {
  return /^\+1\d{10}$/.test(normalizeUsPhone(phone))
}

export function customerGivenName(name: string): string {
  const trimmed = name.trim()
  if (!trimmed) return 'Customer'
  return trimmed.split(/\s+/)[0] ?? 'Customer'
}

export function buildDoorDashItems(items: DeliveryQuoteInput['items']) {
  return items.map((item) => ({
    name: item.name,
    quantity: item.quantity,
    price: item.price,
  }))
}

/** Map Drive v2 + simulator + classic webhook event names to internal order status. */
export const DD_STATUS_MAP: Record<string, string> = {
  DASHER_CONFIRMED: 'confirmed',
  DASHER_CONFIRMED_PICKUP_ARRIVAL: 'preparing',
  DASHER_PICKED_UP: 'picked_up',
  DASHER_CONFIRMED_DROPOFF_ARRIVAL: 'picked_up',
  DASHER_DROPPED_OFF: 'delivered',
  DELIVERY_CANCELLED: 'cancelled',
  dasher_confirmed: 'confirmed',
  dasher_enroute_to_pickup: 'confirmed',
  dasher_confirmed_pickup_arrival: 'preparing',
  dasher_arrived_at_pickup: 'preparing',
  dasher_picked_up: 'picked_up',
  pickup_complete: 'picked_up',
  dasher_enroute_to_dropoff: 'picked_up',
  dasher_confirmed_dropoff_arrival: 'picked_up',
  dasher_dropped_off: 'delivered',
  delivered: 'delivered',
  delivery_cancelled: 'cancelled',
}

export function userFacingDoorDashError(status: number, body: string): string {
  const lower = body.toLowerCase()
  if (lower.includes('distance') || lower.includes('service area') || lower.includes('coverage')) {
    return 'Delivery is not available to this address. Please confirm your address or choose pickup.'
  }
  if (lower.includes('phone')) {
    return 'Please enter a valid phone number with area code.'
  }
  if (lower.includes('address') || lower.includes('validation')) {
    return 'Please check your delivery address and try again.'
  }
  if (lower.includes('duplicate')) {
    return 'Delivery quote expired. Please wait a moment and try again.'
  }
  if (status >= 500) {
    return 'Delivery is temporarily unavailable. Please try again shortly.'
  }
  return 'Delivery is not available for this order. Please try a different address or choose pickup.'
}

export async function doorDashRequest(
  path: string,
  init: { method: string; body?: unknown },
): Promise<Response> {
  const token = buildDoorDashJwt()
  return fetch(`${DOORDASH_BASE}${path}`, {
    method: init.method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: init.body != null ? JSON.stringify(init.body) : undefined,
  })
}

export async function readDoorDashError(resp: Response): Promise<string> {
  try {
    const json = (await resp.json()) as { message?: string; error?: string }
    if (json.message) return json.message
    if (json.error) return String(json.error)
    return JSON.stringify(json)
  } catch {
    return await resp.text()
  }
}

export function logDoorDashFailure(label: string, resp: Response, body: string) {
  functions.logger.error(label, { status: resp.status, body })
}

export function etaMinutesFromDropoff(iso: string | undefined): number {
  if (!iso) return 30
  const ms = new Date(iso).getTime() - Date.now()
  return Math.max(5, Math.round(ms / 60000))
}
