import { MenuItem } from '../types/menu'
import { STATIC_MENU } from '../constants/staticMenu'
import { DEFAULT_LOCATION_ID } from '../constants/config'
import { getDishImageUrl, hasLocalDishImage } from './menuImages'

export function isMenuItemOrderable(item: MenuItem): boolean {
  return item.isAvailable !== false
}

/** Shared-menu rule: items at the flagship store are offered at new locations until restricted. */
export function itemAvailableAtLocation(item: MenuItem, locationId: string): boolean {
  const ids = item.locationIds ?? []
  if (ids.length === 0) return true
  if (ids.includes(locationId)) return true
  if (locationId !== DEFAULT_LOCATION_ID && ids.includes(DEFAULT_LOCATION_ID)) return true
  return false
}

function ensureImage(item: MenuItem): MenuItem {
  if (hasLocalDishImage(item.id) || !item.imageURL) {
    return {
      ...item,
      imageURL: getDishImageUrl(item.id, item.name, item.category),
    }
  }
  return item
}

export function getStaticMenuCatalog(
  locationId: string = DEFAULT_LOCATION_ID,
  opts?: { category?: string; includeUnavailable?: boolean },
): MenuItem[] {
  return (STATIC_MENU as MenuItem[])
    .filter((i) => {
      if (!itemAvailableAtLocation(i, locationId)) return false
      if (!opts?.includeUnavailable && !i.isAvailable) return false
      if (opts?.category && i.category !== opts.category) return false
      return true
    })
    .map(ensureImage)
}

/** Static base + Firestore overrides (Firestore wins on conflict). */
export function mergeMenuItems(staticItems: MenuItem[], remoteItems: MenuItem[]): MenuItem[] {
  const remoteMap = new Map(remoteItems.map((i) => [i.id, i]))

  const merged = staticItems.map((item) => {
    const remote = remoteMap.get(item.id)
    return remote ? { ...item, ...remote, id: item.id } : item
  })

  for (const [id, remote] of remoteMap) {
    if (!staticItems.some((s) => s.id === id)) {
      merged.push(remote)
    }
  }

  return merged
}

export function filterMenuForDisplay(
  items: MenuItem[],
  locationId: string = DEFAULT_LOCATION_ID,
  category?: string,
): MenuItem[] {
  return items
    .filter((i) => itemAvailableAtLocation(i, locationId))
    .filter((i) => !category || i.category === category)
    .sort((a, b) => {
      const avail = Number(isMenuItemOrderable(b)) - Number(isMenuItemOrderable(a))
      if (avail !== 0) return avail
      return a.category.localeCompare(b.category) || a.name.localeCompare(b.name)
    })
}

export function sortMenuItems(items: MenuItem[]): MenuItem[] {
  return [...items].sort(
    (a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name),
  )
}
