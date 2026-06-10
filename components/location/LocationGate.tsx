import React, { useEffect, useMemo, useState } from 'react'
import { useLocationStore } from '../../store/locationStore'
import { useLocations } from '../../hooks/useLocations'
import { useLocationSelection } from '../../hooks/useLocationSelection'
import { LocationPickerModal } from './LocationPickerModal'

interface LocationGateProps {
  children: React.ReactNode
}

export function LocationGate({ children }: LocationGateProps) {
  const hydrate = useLocationStore((s) => s.hydrate)
  const hasHydrated = useLocationStore((s) => s.hasHydrated)
  const selectedLocationId = useLocationStore((s) => s.selectedLocationId)
  const { locations, loading } = useLocations()
  const { selectLocation, applyLocation } = useLocationSelection()
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    hydrate()
  }, [hydrate])

  const validSelection = useMemo(
    () => Boolean(selectedLocationId && locations.some((l) => l.id === selectedLocationId)),
    [locations, selectedLocationId],
  )

  useEffect(() => {
    if (!hasHydrated || loading || locations.length === 0) return

    if (validSelection) return

    if (locations.length === 1) {
      applyLocation(locations[0].id)
    }
  }, [hasHydrated, loading, locations, validSelection, applyLocation])

  const mustPick = hasHydrated && !loading && locations.length > 1 && !validSelection && !dismissed

  return (
    <>
      {children}
      <LocationPickerModal
        visible={mustPick}
        locations={locations}
        selectedLocationId={selectedLocationId}
        loading={loading}
        title="Select your location"
        required
        onSelect={(id) => {
          selectLocation(id, () => setDismissed(true))
        }}
        onClose={() => {}}
      />
    </>
  )
}
