import { useState, useCallback } from 'react'
import { useAuthStore } from '../store/authStore'
import {
  submitReservation,
  validateReservation,
  ReservationInput,
} from '../lib/services/reservationService'

export function useReservation() {
  const { firebaseUser, userProfile } = useAuthStore()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = useCallback(
    async (input: Omit<ReservationInput, 'userId'>) => {
      setError(null)
      const payload: ReservationInput = {
        ...input,
        userId: firebaseUser?.uid ?? 'guest',
      }

      const validation = validateReservation(payload)
      if (!validation.valid) {
        setError(validation.errors[0])
        throw new Error(validation.errors[0])
      }

      setLoading(true)
      try {
        const id = await submitReservation(payload)
        return id
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Failed to submit reservation'
        setError(message)
        throw e
      } finally {
        setLoading(false)
      }
    },
    [firebaseUser],
  )

  const defaultName = userProfile?.displayName ?? ''
  const defaultEmail = userProfile?.email ?? firebaseUser?.email ?? ''
  const defaultPhone = userProfile?.phone ?? ''

  return { submit, loading, error, defaultName, defaultEmail, defaultPhone }
}
