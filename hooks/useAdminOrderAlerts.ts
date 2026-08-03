import { useCallback, useEffect, useRef, useState } from 'react'
import { Platform } from 'react-native'
import {
  OrderAlertSnapshot,
  shouldAlertForNewPaidOrder,
  snapshotOrderForAlerts,
} from '../lib/admin/orderAlerts'
import { Order } from '../types/order'

export function useAdminOrderAlerts(orders: Order[], loading: boolean, enabled: boolean) {
  const [queue, setQueue] = useState<Order[]>([])
  const readyRef = useRef(false)
  const previousRef = useRef<Map<string, OrderAlertSnapshot>>(new Map())
  const alertedRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (Platform.OS !== 'web' || !enabled || loading) return

    if (!readyRef.current) {
      const seeded = new Map<string, OrderAlertSnapshot>()
      for (const order of orders) {
        seeded.set(order.id, snapshotOrderForAlerts(order))
      }
      previousRef.current = seeded
      readyRef.current = true
      return
    }

    const newlyAlerted: Order[] = []

    for (const order of orders) {
      if (alertedRef.current.has(order.id)) {
        previousRef.current.set(order.id, snapshotOrderForAlerts(order))
        continue
      }

      const previous = previousRef.current.get(order.id)
      if (!shouldAlertForNewPaidOrder(previous, order)) {
        previousRef.current.set(order.id, snapshotOrderForAlerts(order))
        continue
      }

      alertedRef.current.add(order.id)
      previousRef.current.set(order.id, snapshotOrderForAlerts(order))
      newlyAlerted.push(order)
    }

    if (newlyAlerted.length > 0) {
      setQueue((current) => [...current, ...newlyAlerted])
    }
  }, [orders, loading, enabled])

  const dismissCurrent = useCallback(() => {
    setQueue((current) => current.slice(1))
  }, [])

  return { queue, dismissCurrent }
}
