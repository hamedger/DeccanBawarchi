import {
  formatPickupSchedule,
  getCustomPickupTimeInputBounds,
  getPickupDateOptions,
  getPickupTimeSlotsForDate,
  isCustomPickupTimeValid,
  isPickupScheduleValid,
  isPresetPickupTime,
  normalizePickupTimeValue,
  pickupTimeFromInputValue,
  PICKUP_ASAP,
  getDefaultPickupDate,
} from '../lib/services/pickupScheduling'

describe('pickupScheduling', () => {
  it('returns date options including today', () => {
    const options = getPickupDateOptions()
    expect(options.length).toBe(7)
    expect(options[0].label).toBe('Today')
    expect(options[0].value).toBe(getDefaultPickupDate())
  })

  it('includes ASAP for today and filters past slots', () => {
    const today = getDefaultPickupDate()
    const slots = getPickupTimeSlotsForDate(today)
    expect(slots[0]).toBe(PICKUP_ASAP)
    expect(slots.length).toBeGreaterThan(1)
  })

  it('formats scheduled pickup', () => {
    expect(formatPickupSchedule('2099-06-15', '6:30 PM')).toMatch(/6:30 PM/)
    expect(formatPickupSchedule(getDefaultPickupDate(), PICKUP_ASAP)).toContain('ASAP')
  })

  it('accepts custom pickup times within hours', () => {
    expect(normalizePickupTimeValue('18:45')).toBe('6:45 PM')
    expect(isPresetPickupTime('6:45 PM')).toBe(false)
    expect(isCustomPickupTimeValid('2099-06-15', '6:45 PM')).toBe(true)
    expect(isPickupScheduleValid('2099-06-15', '6:45 PM')).toBe(true)
    expect(isPickupScheduleValid('2099-06-15', '6:30 PM')).toBe(true)
  })

  it('rejects custom pickup times outside hours', () => {
    expect(isCustomPickupTimeValid('2099-06-15', '10:15 AM')).toBe(false)
    expect(isPickupScheduleValid('2099-06-15', '11:15 PM')).toBe(false)
  })

  it('provides input bounds for custom time picker', () => {
    const bounds = getCustomPickupTimeInputBounds('2099-06-15')
    expect(bounds.min).toBe('11:30')
    expect(bounds.max).toBe('23:00')
    expect(pickupTimeFromInputValue('18:15')).toBe('6:15 PM')
  })
})
