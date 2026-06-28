const LOCATION_ID_ALIASES: Record<string, string> = {
  farmingtonhills: 'farmington-hills-mi',
}

export function normalizeLocationId(locationId: string): string {
  const trimmed = locationId.trim()
  if (!trimmed) return ''
  const key = trimmed.toLowerCase()
  return LOCATION_ID_ALIASES[key] ?? trimmed
}
