/** True when Clover or Stripe payment has been recorded on the order. */
export function hasOrderPayment(order: Record<string, unknown>): boolean {
  return (
    String(order.cloverPaymentId ?? '').trim().length > 0 ||
    String(order.stripePaymentIntentId ?? '').trim().length > 0
  )
}

/** Firestore before/after: payment just succeeded (status → placed or payment id set). */
export function orderPaymentJustRecorded(
  before: Record<string, unknown> | undefined,
  after: Record<string, unknown>,
): boolean {
  if (before?.status !== 'placed' && after.status === 'placed') return true
  if (
    !String(before?.cloverPaymentId ?? '').trim() &&
    String(after.cloverPaymentId ?? '').trim()
  ) {
    return true
  }
  if (
    !String(before?.stripePaymentIntentId ?? '').trim() &&
    String(after.stripePaymentIntentId ?? '').trim()
  ) {
    return true
  }
  return false
}

export const POST_PAYMENT_STATUSES = new Set([
  'placed',
  'confirmed',
  'preparing',
  'ready',
  'picked_up',
  'delivered',
])
