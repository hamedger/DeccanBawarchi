import { config } from '../config'
import { CloverLocationConfig } from '../lib/cloverLocations'

export interface CheckoutSessionStatus {
  paid: boolean
  paymentId: string
  raw: unknown
}

const PAID_STATUS_VALUES = new Set(['PAID', 'COMPLETE', 'COMPLETED', 'APPROVED', 'SUCCEEDED'])

function extractPaymentId(payload: Record<string, unknown>): string {
  const direct = payload.paymentId ?? payload.PaymentId
  if (typeof direct === 'string' && direct.trim()) return direct.trim()

  const payments = payload.payments ?? payload.Payments
  if (Array.isArray(payments) && payments.length > 0) {
    const first = payments[0]
    if (first && typeof first === 'object') {
      const id = (first as Record<string, unknown>).id ?? (first as Record<string, unknown>).Id
      if (typeof id === 'string' && id.trim()) return id.trim()
    }
  }
  return ''
}

function extractStatus(payload: Record<string, unknown>): string {
  const status =
    payload.status ??
    payload.Status ??
    payload.state ??
    payload.State ??
    payload.paymentStatus ??
    payload.PaymentStatus
  return String(status ?? '').toUpperCase()
}

/**
 * Polling fallback for when Clover's webhook / hosted-checkout redirect don't fire
 * (both are unreliable for this integration as of 2026-07). Field names are a
 * best guess at Clover's Invoicing Checkout Service response shape — `raw` is
 * always returned so a mismatch is visible in logs/Firestore rather than silent.
 */
export async function getCheckoutSessionStatus(
  clover: CloverLocationConfig,
  checkoutSessionId: string,
): Promise<CheckoutSessionStatus | null> {
  const response = await fetch(
    `${config.clover.apiBaseUrl}/invoicingcheckoutservice/v1/checkouts/${encodeURIComponent(checkoutSessionId)}`,
    {
      method: 'GET',
      headers: {
        accept: 'application/json',
        'X-Clover-Merchant-Id': clover.merchantId,
        Authorization: `Bearer ${clover.privateKey}`,
      },
    },
  )

  if (!response.ok) {
    if (response.status === 404) return null
    const body = await response.text().catch(() => '')
    throw new Error(`Clover checkout status lookup failed (${response.status}): ${body}`)
  }

  const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>
  const status = extractStatus(payload)
  const paymentId = extractPaymentId(payload)

  return {
    paid: PAID_STATUS_VALUES.has(status) || !!paymentId,
    paymentId,
    raw: payload,
  }
}
