import { useState } from 'react'
import { getDeliveryQuote } from '../lib/doordash'
import { DeliveryQuote } from '../types/delivery'

export function useDeliveryQuote() {
  const [quote, setQuote] = useState<DeliveryQuote | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchQuote = async (dropoffAddress: string, orderValue: number) => {
    setLoading(true)
    setError(null)
    try {
      const result = await getDeliveryQuote({ dropoffAddress, orderValue })
      setQuote(result.data as DeliveryQuote)
    } catch (e: any) {
      setError(e.message ?? 'Unable to get delivery quote')
    } finally {
      setLoading(false)
    }
  }

  return { quote, loading, error, fetchQuote }
}
