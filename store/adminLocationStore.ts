import { create } from 'zustand'
import { readAdminLocationFilter, writeAdminLocationFilter } from '../lib/locationStorage'

interface AdminLocationState {
  filterLocationId: string | null
  hasHydrated: boolean
  hydrate: () => void
  setFilterLocationId: (id: string | null) => void
}

export const useAdminLocationStore = create<AdminLocationState>((set) => ({
  filterLocationId: null,
  hasHydrated: false,

  hydrate: () => {
    const stored = readAdminLocationFilter()
    set({ filterLocationId: stored, hasHydrated: true })
  },

  setFilterLocationId: (id) => {
    writeAdminLocationFilter(id)
    set({ filterLocationId: id })
  },
}))
