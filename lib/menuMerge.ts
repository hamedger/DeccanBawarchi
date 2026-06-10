import { MenuItem } from '../types/menu'
import { STATIC_MENU } from '../constants/staticMenu'
import { DEFAULT_LOCATION_ID } from '../constants/config'
import { getDishImageUrl, hasLocalDishImage } from './menuImages'

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
      if (!i.locationIds.includes(locationId)) return false
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
    .filter((i) => i.locationIds?.includes(locationId) && i.isAvailable !== false)
    .filter((i) => !category || i.category === category)
    .sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name))
}

export function sortMenuItems(items: MenuItem[]): MenuItem[] {
  return [...items].sort(
    (a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name),
  )
}
