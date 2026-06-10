import { useEffect, useMemo } from 'react'
import { DEFAULT_LOCATION_ID } from '../constants/config'
import { useLocationStore } from '../store/locationStore'
import { useLocations } from './useLocations'

export function useSelectedLocation() {
  const hydrate = useLocationStore((s) => s.hydrate)
  const selectedLocationId = useLocationStore((s) => s.selectedLocationId)
  const hasHydrated = useLocationStore((s) => s.hasHydrated)
  const { locations, loading } = useLocations()

  useEffect(() => {
    hydrate()
  }, [hydrate])

  const location = useMemo(
    () => locations.find((l) => l.id === selectedLocationId) ?? null,
    [locations, selectedLocationId],
  )

  const orderingLocationId = location?.id ?? selectedLocationId ?? DEFAULT_LOCATION_ID

  return {
    location,
    locationId: orderingLocationId,
    selectedLocationId,
    locations,
    loading: loading || !hasHydrated,
    hasSelection: Boolean(location),
  }
}
