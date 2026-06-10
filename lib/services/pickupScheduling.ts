import { addDays, format, isToday, parse } from 'date-fns'
import { toZonedTime } from 'date-fns-tz'
import { MOCK_PICKUP_ETA_MINUTES } from '../../constants/checkout'
import { TIMEZONE } from '../../constants/config'

export const PICKUP_ASAP = 'asap'
export const PICKUP_ADVANCE_DAYS = 7
export const PICKUP_PREP_BUFFER_MINUTES = 30

export const PICKUP_TIME_SLOTS = [
  '11:30 AM', '12:00 PM', '12:30 PM', '1:00 PM', '1:30 PM', '2:00 PM',
  '2:30 PM', '3:00 PM', '3:30 PM', '4:00 PM', '4:30 PM', '5:00 PM',
  '5:30 PM', '6:00 PM', '6:30 PM', '7:00 PM', '7:30 PM', '8:00 PM',
  '8:30 PM', '9:00 PM', '9:30 PM', '10:00 PM', '10:30 PM', '11:00 PM',
] as const

export type PickupTimeSlot = typeof PICKUP_TIME_SLOTS[number] | typeof PICKUP_ASAP

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

export function getPickupTimeSlotsForDate(dateValue: string): PickupTimeSlot[] {
  const date = parse(dateValue, 'yyyy-MM-dd', detroitNow())
  const slots: PickupTimeSlot[] = []

  if (isToday(date)) {
    slots.push(PICKUP_ASAP)
  }

  const minMinutes = isToday(date)
    ? detroitMinutesNow() + PICKUP_PREP_BUFFER_MINUTES
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

export function isPickupScheduleValid(dateValue: string, timeValue: string): boolean {
  if (!dateValue || !timeValue) return false
  const available = getPickupTimeSlotsForDate(dateValue)
  return available.includes(timeValue as PickupTimeSlot)
}
