import {
  formatPickupSchedule,
  getPickupDateOptions,
  getPickupTimeSlotsForDate,
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
})
