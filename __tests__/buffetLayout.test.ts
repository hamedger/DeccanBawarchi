import { groupBuffetDishesForCustomer, createDefaultBuffetDishes } from '../lib/buffetLayout'
import { BuffetDish } from '../types/buffet'

describe('buffetLayout', () => {
  const sampleDishes: BuffetDish[] = [
    {
      menuItemId: 'butter-chicken',
      name: 'Butter Chicken',
      isVegetarian: false,
      isNew: false,
      sortOrder: 0,
      isServing: true,
    },
    {
      menuItemId: 'veg-samosa',
      name: 'Samosa',
      isVegetarian: true,
      isNew: false,
      sortOrder: 1,
      isServing: true,
    },
    {
      menuItemId: 'tarka-dal',
      name: 'Dal',
      isVegetarian: true,
      isNew: false,
      sortOrder: 2,
      isServing: false,
    },
  ]

  it('groups all buffet dishes by section with paused items last', () => {
    const groups = groupBuffetDishesForCustomer(sampleDishes)
    expect(groups.map((g) => g.id)).toEqual(['veg-vegan-starters', 'vegan-entrees', 'chicken-options'])
    expect(groups[0].dishes.map((d) => d.menuItemId)).toEqual(['veg-samosa'])
    expect(groups[0].dishes[0].name).toBe('Samosa (Vegan)')
    expect(groups[1].dishes.map((d) => d.menuItemId)).toEqual(['tarka-dal'])
    expect(groups[2].dishes.map((d) => d.menuItemId)).toEqual(['butter-chicken'])
  })

  it('builds default buffet dishes from static menu ids', () => {
    const dishes = createDefaultBuffetDishes([
      { id: 'veg-samosa', isVegetarian: true },
      { id: 'butter-chicken', isVegetarian: false },
      { id: 'water', isVegetarian: true },
    ])

    expect(dishes.map((d) => d.menuItemId)).toEqual(['veg-samosa', 'butter-chicken', 'water'])
    expect(dishes[0].name).toBe('Samosa (Vegan)')
    expect(dishes[0].buffetCategory).toBe('veg-vegan-starters')
  })
})
