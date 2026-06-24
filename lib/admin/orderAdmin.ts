import { getFunctions, httpsCallable } from 'firebase/functions'
import app, { isFirebaseConfigured } from '../firebase'
import { OrderStatus } from '../../types/order'

export const ORDER_STATUS_FLOW: OrderStatus[] = [
  'pending',
  'confirmed',
  'preparing',
  'ready',
  'picked_up',
  'delivered',
]

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  preparing: 'Preparing',
  ready: 'Ready',
  picked_up: 'Picked Up',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
}

export async function updateAdminOrderStatus(orderId: string, status: OrderStatus) {
  if (!isFirebaseConfigured) throw new Error('Firebase is not configured')

  const functions = getFunctions(app, 'us-central1')
  const updateOrderStatus = httpsCallable(functions, 'updateOrderStatus')
  await updateOrderStatus({
    orderId,
    status,
  })
}

export function nextOrderStatus(current: OrderStatus): OrderStatus | null {
  const idx = ORDER_STATUS_FLOW.indexOf(current)
  if (idx < 0 || idx >= ORDER_STATUS_FLOW.length - 1) return null
  return ORDER_STATUS_FLOW[idx + 1]
}
