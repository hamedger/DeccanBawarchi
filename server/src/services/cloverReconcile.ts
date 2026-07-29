import { db } from '../lib/firebase'
import { getCloverLocationConfig } from '../lib/cloverLocations'
import { getCheckoutSessionStatus } from './cloverCheckoutStatus'
import { markOrderPaidByCheckoutSession } from './orderService'

const RECONCILE_WINDOW_MS = 2 * 60 * 60 * 1000

/**
 * Fallback for when Clover's webhook and the client-side post-payment redirect
 * both fail to reach us (confirmed unreliable as of 2026-07 — see incident notes).
 * Polls Clover directly for any order still pending with an open checkout session,
 * so payment confirmation doesn't depend on Clover successfully calling us.
 */
export async function reconcilePendingCloverOrders(): Promise<void> {
  const cutoff = new Date(Date.now() - RECONCILE_WINDOW_MS)

  const snapshot = await db.collection('orders').where('status', '==', 'pending').get()

  let checked = 0
  let recovered = 0
  let skipped = 0

  for (const doc of snapshot.docs) {
    const order = doc.data()
    const checkoutSessionId = String(order.cloverCheckoutSessionId ?? '').trim()
    if (!checkoutSessionId) {
      skipped++
      continue
    }

    const createdAt = order.createdAt?.toDate?.() ?? null
    if (createdAt && createdAt < cutoff) {
      skipped++
      continue
    }

    const locationId = String(order.locationId ?? '').trim()
    if (!locationId) {
      skipped++
      continue
    }

    checked++

    try {
      const clover = getCloverLocationConfig(locationId)
      const status = await getCheckoutSessionStatus(clover, checkoutSessionId)

      console.log('[cloverReconcile] Checked order', {
        orderId: doc.id,
        checkoutSessionId,
        paid: status?.paid ?? null,
        paymentId: status?.paymentId ?? null,
        raw: status?.raw ?? null,
      })

      if (status?.paid) {
        recovered++
        console.log('[cloverReconcile] Recovering payment confirmation via poll', {
          orderId: doc.id,
          checkoutSessionId,
        })
        await markOrderPaidByCheckoutSession(checkoutSessionId, status.paymentId)
      }
    } catch (err) {
      console.error('[cloverReconcile] Failed to reconcile order', {
        orderId: doc.id,
        checkoutSessionId,
        err,
      })
    }
  }

  console.log('[cloverReconcile] Poll cycle complete', {
    totalPending: snapshot.size,
    checked,
    recovered,
    skipped,
  })
}

export function startCloverReconciliationPoller(intervalMs = 60_000): NodeJS.Timeout {
  reconcilePendingCloverOrders().catch((err) => {
    console.error('[cloverReconcile] Initial poll failed', err)
  })

  return setInterval(() => {
    reconcilePendingCloverOrders().catch((err) => {
      console.error('[cloverReconcile] Poll cycle failed', err)
    })
  }, intervalMs)
}
