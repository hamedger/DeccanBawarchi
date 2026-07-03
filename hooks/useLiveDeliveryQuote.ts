import { useCallback, useEffect, useRef, useState } from 'react'
import { getDeliveryQuote } from '../lib/doordash'
import { DeliveryQuote } from '../types/delivery'
import { OrderItem } from '../types/order'
import { DropoffAddressInput, formatDropoffAddress } from '../lib/deliveryUtils'

const QUOTE_REFRESH_MS = 5 * 60 * 1000

interface UseLiveDeliveryQuoteOptions {
  enabled: boolean
  dropoffAddress: DropoffAddressInput | null
  orderValue: number
  items: OrderItem[]
  dropoffPhoneNumber: string
  dropoffContactGivenName: string
  pickupTimeIso?: string
  debounceMs?: number
  onQuote: (quote: DeliveryQuote) => void
  onClear: () => void
}

export function useLiveDeliveryQuote({
  enabled,
  dropoffAddress,
  orderValue,
  items,
  dropoffPhoneNumber,
  dropoffContactGivenName,
  pickupTimeIso,
  debounceMs = 600,
  onQuote,
  onClear,
}: UseLiveDeliveryQuoteOptions) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const requestId = useRef(0)

  const fetchQuote = useCallback(async () => {
    if (
      !enabled ||
      !dropoffAddress?.street.trim() ||
      !dropoffAddress.city.trim() ||
      !dropoffAddress.zip.trim()
    ) {
      onClear()
      setError(null)
      setLoading(false)
      return
    }
    if (orderValue <= 0) {
      onClear()
      setError(null)
      setLoading(false)
      return
    }

    const id = ++requestId.current
    setLoading(true)
    setError(null)

    try {
      const result = await getDeliveryQuote({
        // Legacy single-line field for deployed doordashQuote until functions are updated
        dropoffAddress: formatDropoffAddress(dropoffAddress),
        dropoffStreet: dropoffAddress.street.trim(),
        dropoffCity: dropoffAddress.city.trim(),
        dropoffState: dropoffAddress.state.trim() || 'MI',
        dropoffZip: dropoffAddress.zip.trim(),
        dropoffCountry: dropoffAddress.country ?? 'US',
        dropoffUnit: dropoffAddress.unit,
        orderValue,
        dropoffPhoneNumber,
        dropoffContactGivenName,
        pickupTime: pickupTimeIso,
        items: items.map((item) => ({
          name: item.name,
          quantity: item.quantity,
          price: item.price,
        })),
      })
      if (id !== requestId.current) return
      onQuote(result.data as DeliveryQuote)
    } catch (e: unknown) {
      if (id !== requestId.current) return
      onClear()
      const message =
        e instanceof Error ? e.message : 'Unable to get delivery quote for this address'
      setError(message)
    } finally {
      if (id === requestId.current) setLoading(false)
    }
  }, [
    enabled,
    dropoffAddress,
    orderValue,
    items,
    dropoffPhoneNumber,
    dropoffContactGivenName,
    pickupTimeIso,
    onQuote,
    onClear,
  ])

  useEffect(() => {
    if (!enabled) {
      onClear()
      setError(null)
      setLoading(false)
      return
    }

    if (!dropoffAddress?.street.trim()) {
      onClear()
      setError(null)
      return
    }

    const timer = setTimeout(() => {
      void fetchQuote()
    }, debounceMs)

    return () => clearTimeout(timer)
  }, [enabled, dropoffAddress, orderValue, items, pickupTimeIso, debounceMs, fetchQuote, onClear])

  useEffect(() => {
    if (!enabled || !dropoffAddress?.street.trim()) return

    const interval = setInterval(() => {
      void fetchQuote()
    }, QUOTE_REFRESH_MS)

    return () => clearInterval(interval)
  }, [enabled, dropoffAddress, fetchQuote])

  return { loading, error, refreshQuote: fetchQuote }
}
