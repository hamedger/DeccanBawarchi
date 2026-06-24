import { addDays, format, isToday, parse } from 'date-fns'
import { toZonedTime } from 'date-fns-tz'
import { MOCK_PICKUP_ETA_MINUTES } from '../../constants/checkout'
import { DEFAULT_PICKUP_PREP_BUFFER_MINUTES } from '../../constants/config'
import { TIMEZONE } from '../../constants/config'

export const PICKUP_ASAP = 'asap'
export const PICKUP_ADVANCE_DAYS = 7
export const PICKUP_PREP_BUFFER_MINUTES = DEFAULT_PICKUP_PREP_BUFFER_MINUTES

export const PICKUP_TIME_SLOTS = [
  '11:30 AM', '12:00 PM', '12:30 PM', '1:00 PM', '1:30 PM', '2:00 PM',
  '2:30 PM', '3:00 PM', '3:30 PM', '4:00 PM', '4:30 PM', '5:00 PM',
  '5:30 PM', '6:00 PM', '6:30 PM', '7:00 PM', '7:30 PM', '8:00 PM',
  '8:30 PM', '9:00 PM', '9:30 PM', '10:00 PM', '10:30 PM', '11:00 PM',
] as const

export type PickupTimeSlot = typeof PICKUP_TIME_SLOTS[number] | typeof PICKUP_ASAP

const PICKUP_OPEN_MINUTES = parseTimeSlotMinutes(PICKUP_TIME_SLOTS[0])
const PICKUP_CLOSE_MINUTES = parseTimeSlotMinutes(
  PICKUP_TIME_SLOTS[PICKUP_TIME_SLOTS.length - 1],
)

export interface PickupDateOption {
  value: string
  label: string
  sublabel: string
}

function detroitNow(): Date {
  return toZonedTime(new Date(), TIMEZONE)
}

function parseTimeSlotMinutes(slot: string): number {
  const parsed = parse(slot, 'h:mm a', detroitNow())
  return parsed.getHours() * 60 + parsed.getMinutes()
}

function minutesToInputValue(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`
}

function getMinPickupMinutesForDate(
  dateValue: string,
  prepBufferMinutes: number,
): number {
  const date = parse(dateValue, 'yyyy-MM-dd', detroitNow())
  if (isToday(date)) {
    return Math.max(PICKUP_OPEN_MINUTES, detroitMinutesNow() + prepBufferMinutes)
  }
  return PICKUP_OPEN_MINUTES
}

export function isPresetPickupTime(timeValue: string): boolean {
  if (!timeValue || timeValue === PICKUP_ASAP) return timeValue === PICKUP_ASAP
  return (PICKUP_TIME_SLOTS as readonly string[]).includes(timeValue)
}

export function normalizePickupTimeValue(timeValue: string): string | null {
  const trimmed = timeValue.trim()
  if (!trimmed) return null

  const presetParsed = parse(trimmed, 'h:mm a', detroitNow())
  if (!Number.isNaN(presetParsed.getTime())) {
    return format(presetParsed, 'h:mm a')
  }

  const h24Parsed = parse(trimmed, 'HH:mm', detroitNow())
  if (!Number.isNaN(h24Parsed.getTime())) {
    return format(h24Parsed, 'h:mm a')
  }

  return null
}

export function getPickupTimeMinutes(timeValue: string): number | null {
  if (timeValue === PICKUP_ASAP) return null
  const normalized = normalizePickupTimeValue(timeValue)
  if (!normalized) return null
  return parseTimeSlotMinutes(normalized)
}

export function isCustomPickupTimeValid(
  dateValue: string,
  timeValue: string,
  prepBufferMinutes: number = PICKUP_PREP_BUFFER_MINUTES,
): boolean {
  const minutes = getPickupTimeMinutes(timeValue)
  if (minutes === null) return false
  if (minutes < getMinPickupMinutesForDate(dateValue, prepBufferMinutes)) return false
  if (minutes > PICKUP_CLOSE_MINUTES) return false
  return true
}

export function getCustomPickupTimeInputBounds(
  dateValue: string,
  prepBufferMinutes: number = PICKUP_PREP_BUFFER_MINUTES,
): { min: string; max: string } {
  return {
    min: minutesToInputValue(getMinPickupMinutesForDate(dateValue, prepBufferMinutes)),
    max: minutesToInputValue(PICKUP_CLOSE_MINUTES),
  }
}

export function pickupTimeToInputValue(timeValue: string): string {
  const minutes = getPickupTimeMinutes(timeValue)
  return minutes === null ? '' : minutesToInputValue(minutes)
}

export function pickupTimeFromInputValue(inputValue: string): string | null {
  return normalizePickupTimeValue(inputValue)
}

function detroitMinutesNow(): number {
  const now = detroitNow()
  return now.getHours() * 60 + now.getMinutes()
}

export function getDefaultPickupDate(): string {
  return format(detroitNow(), 'yyyy-MM-dd')
}

export function getPickupDateOptions(): PickupDateOption[] {
  const now = detroitNow()
  return Array.from({ length: PICKUP_ADVANCE_DAYS }, (_, i) => {
    const date = addDays(now, i)
    const value = format(date, 'yyyy-MM-dd')
    const label =
      i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : format(date, 'EEE, MMM d')
    const sublabel = format(date, 'MMM d')
    return { value, label, sublabel }
  })
}

export function getPickupTimeSlotsForDate(
  dateValue: string,
  prepBufferMinutes: number = PICKUP_PREP_BUFFER_MINUTES,
): PickupTimeSlot[] {
  const date = parse(dateValue, 'yyyy-MM-dd', detroitNow())
  const slots: PickupTimeSlot[] = []

  if (isToday(date)) {
    slots.push(PICKUP_ASAP)
  }

  const minMinutes = isToday(date)
    ? detroitMinutesNow() + prepBufferMinutes
    : 0

  for (const slot of PICKUP_TIME_SLOTS) {
    if (parseTimeSlotMinutes(slot) >= minMinutes) {
      slots.push(slot)
    }
  }

  return slots
}

export function formatPickupSchedule(dateValue: string, timeValue: string): string {
  if (timeValue === PICKUP_ASAP) {
    return `Today · ASAP (~${MOCK_PICKUP_ETA_MINUTES} min)`
  }

  const date = parse(dateValue, 'yyyy-MM-dd', detroitNow())
  const dateLabel = isToday(date)
    ? 'Today'
    : format(date, 'EEE, MMM d')
  return `${dateLabel} at ${timeValue}`
}

export function isPickupScheduleValid(
  dateValue: string,
  timeValue: string,
  prepBufferMinutes: number = PICKUP_PREP_BUFFER_MINUTES,
): boolean {
  if (!dateValue || !timeValue) return false
  if (timeValue === PICKUP_ASAP) {
    const date = parse(dateValue, 'yyyy-MM-dd', detroitNow())
    return isToday(date)
  }
  if (isPresetPickupTime(timeValue)) {
    const available = getPickupTimeSlotsForDate(dateValue, prepBufferMinutes)
    return available.includes(timeValue as PickupTimeSlot)
  }
  return isCustomPickupTimeValid(dateValue, timeValue, prepBufferMinutes)
}
