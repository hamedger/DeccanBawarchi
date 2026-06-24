import {
  filterMenuForDisplay,
  getMenuItemAvailability,
  isMenuItemOrderable,
  withLocationAvailability,
} from '../lib/menuMerge'
import { MenuItem } from '../types/menu'

const baseItem = {
  id: 'test-item',
  name: 'Test Dish',
  description: '',
  price: 999,
  category: 'curries',
  subcategory: '',
  imageURL: '',
  isAvailable: true,
  isHalal: true,
  isVegetarian: false,
  isSpicy: false,
  spiceLevel: 1 as const,
  allergens: [],
  tags: [],
  isBuffetItem: false,
  rating: 0,
  reviewCount: 0,
  locationIds: ['northville-mi', 'farmington-hills-mi'],
} as MenuItem

describe('menuMerge location stock', () => {
  it('uses global availability when no location override exists', () => {
    expect(getMenuItemAvailability(baseItem, 'northville-mi')).toBe(true)
    expect(getMenuItemAvailability({ ...baseItem, isAvailable: false }, 'northville-mi')).toBe(false)
  })

  it('prefers per-location stock override', () => {
    const item: MenuItem = {
      ...baseItem,
      isAvailable: true,
      locationStock: {
        'farmington-hills-mi': { isAvailable: false },
      },
    }
    expect(getMenuItemAvailability(item, 'northville-mi')).toBe(true)
    expect(getMenuItemAvailability(item, 'farmington-hills-mi')).toBe(false)
    expect(isMenuItemOrderable(item, 'farmington-hills-mi')).toBe(false)
  })

  it('hides unavailable items for a location in customer menu', () => {
    const items: MenuItem[] = [
      baseItem,
      {
        ...baseItem,
        id: 'sold-out-here',
        locationStock: { 'northville-mi': { isAvailable: false } },
      },
    ]

    const visible = filterMenuForDisplay(items, 'northville-mi')
    expect(visible.map((i) => i.id)).toEqual(['test-item'])
  })

  it('applies location availability onto the item object', () => {
    const item = withLocationAvailability(
      {
        ...baseItem,
        locationStock: { 'northville-mi': { isAvailable: false } },
      },
      'northville-mi',
    )
    expect(item.isAvailable).toBe(false)
  })
})
