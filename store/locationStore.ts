import { create } from 'zustand'
import { readStoredLocationId, writeStoredLocationId } from '../lib/locationStorage'

interface LocationState {
  selectedLocationId: string | null
  hasHydrated: boolean
  hydrate: () => void
  setSelectedLocationId: (id: string) => void
  clearSelectedLocation: () => void
}

export const useLocationStore = create<LocationState>((set) => ({
  selectedLocationId: null,
  hasHydrated: false,

  hydrate: () => {
    const stored = readStoredLocationId()
    set({ selectedLocationId: stored, hasHydrated: true })
  },

  setSelectedLocationId: (id) => {
    writeStoredLocationId(id)
    set({ selectedLocationId: id })
  },

  clearSelectedLocation: () => {
    writeStoredLocationId(null)
    set({ selectedLocationId: null })
  },
}))
