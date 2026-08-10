/** Fallback Clover payment id when the webhook omits payment id. */
export function resolveCloverPaymentId(
  paymentId: string | undefined | null,
  checkoutSessionId: string | undefined | null,
): string {
  const resolved = String(paymentId ?? '').trim()
  if (resolved) return resolved
  const sessionId = String(checkoutSessionId ?? '').trim()
  return sessionId ? `clover_${sessionId}` : ''
}

/** True when Clover or Stripe payment has been recorded on the order. */
export function hasOrderPayment(order: Record<string, unknown>): boolean {
  return (
    String(order.cloverPaymentId ?? '').trim().length > 0 ||
    String(order.stripePaymentIntentId ?? '').trim().length > 0
  )
}

/**
 * True when an order is a real, paid order that staff should be notified about.
 *
 * Clover's webhook and hosted-checkout redirect are both unreliable for this
 * integration, so cloverPaymentId frequently never gets recorded even though
 * the customer was charged. An order reaching any post-payment status is itself
 * proof the payment succeeded (it only leaves `pending` once payment is
 * confirmed or staff advance it after seeing it in Clover), so treat that as a
 * confirmation signal independent of whether a payment id ever arrived.
 */
export function orderConfirmed(order: Record<string, unknown>): boolean {
  return hasOrderPayment(order) || POST_PAYMENT_STATUSES.has(String(order.status ?? ''))
}

/** Firestore before/after: order just became a confirmed/paid order. */
export function orderPaymentJustRecorded(
  before: Record<string, unknown> | undefined,
  after: Record<string, unknown>,
): boolean {
  const beforePost = POST_PAYMENT_STATUSES.has(String(before?.status ?? ''))
  const afterPost = POST_PAYMENT_STATUSES.has(String(after.status ?? ''))
  if (!beforePost && afterPost) return true
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
