const LOCATION_LABELS: Record<string, string> = {
  'northville-mi': 'Northville',
  'farmington-hills-mi': 'Farmington Hills',
}

export function getLocationLabel(locationId: string): string {
  return LOCATION_LABELS[locationId] ?? locationId
}
