import { useCallback, useEffect, useRef, useState } from 'react'
import { getDeliveryQuote } from '../lib/doordash'
import { DeliveryQuote } from '../types/delivery'

interface UseLiveDeliveryQuoteOptions {
  enabled: boolean
  dropoffAddress: string
  orderValue: number
  debounceMs?: number
  onQuote: (quote: DeliveryQuote) => void
  onClear: () => void
}

export function useLiveDeliveryQuote({
  enabled,
  dropoffAddress,
  orderValue,
  debounceMs = 600,
  onQuote,
  onClear,
}: UseLiveDeliveryQuoteOptions) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const requestId = useRef(0)

  const fetchQuote = useCallback(async () => {
    if (!enabled || !dropoffAddress.trim() || orderValue <= 0) {
      onClear()
      setError(null)
      setLoading(false)
      return
    }

    const id = ++requestId.current
    setLoading(true)
    setError(null)

    try {
      const result = await getDeliveryQuote({ dropoffAddress, orderValue })
      if (id !== requestId.current) return
      const quote = result.data as DeliveryQuote
      onQuote(quote)
    } catch (e: unknown) {
      if (id !== requestId.current) return
      onClear()
      const message =
        e instanceof Error ? e.message : 'Unable to get delivery quote for this address'
      setError(message)
    } finally {
      if (id === requestId.current) setLoading(false)
    }
  }, [enabled, dropoffAddress, orderValue, onQuote, onClear])

  useEffect(() => {
    if (!enabled) {
      onClear()
      setError(null)
      setLoading(false)
      return
    }

    if (!dropoffAddress.trim()) {
      onClear()
      setError(null)
      return
    }

    const timer = setTimeout(() => {
      void fetchQuote()
    }, debounceMs)

    return () => clearTimeout(timer)
  }, [enabled, dropoffAddress, orderValue, debounceMs, fetchQuote, onClear])

  return { loading, error, refreshQuote: fetchQuote }
}
