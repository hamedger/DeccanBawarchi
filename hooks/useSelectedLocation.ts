import { useEffect, useMemo } from 'react'
import { DEFAULT_LOCATION_ID } from '../constants/config'
import { STATIC_LOCATIONS } from '../constants/staticLocations'
import { useLocationStore } from '../store/locationStore'
import { useLocations } from './useLocations'
import { isLocationActive } from '../lib/locationUtils'

const PICKABLE_LOCATIONS = STATIC_LOCATIONS.filter(isLocationActive)

export function useSelectedLocation() {
  const hydrate = useLocationStore((s) => s.hydrate)
  const selectedLocationId = useLocationStore((s) => s.selectedLocationId)
  const hasHydrated = useLocationStore((s) => s.hasHydrated)
  const { locations, loading } = useLocations()

  useEffect(() => {
    hydrate()
  }, [hydrate])

  const location = useMemo(() => {
    if (!selectedLocationId) return null
    return (
      locations.find((l) => l.id === selectedLocationId) ??
      PICKABLE_LOCATIONS.find((l) => l.id === selectedLocationId) ??
      null
    )
  }, [locations, selectedLocationId])

  const orderingLocationId = location?.id ?? selectedLocationId ?? DEFAULT_LOCATION_ID

  return {
    location,
    locationId: orderingLocationId,
    selectedLocationId,
    locations,
    loading: loading || !hasHydrated,
    hasHydrated,
    hasSelection: Boolean(location),
  }
}
