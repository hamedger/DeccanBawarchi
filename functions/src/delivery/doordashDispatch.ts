import * as functions from 'firebase-functions/v2'
import { db, FieldValue, Timestamp } from '../db'
import {
  doorDashRequest,
  isValidUsPhone,
  logDoorDashFailure,
  normalizeUsPhone,
  readDoorDashError,
  userFacingDoorDashError,
} from './doordashShared'

interface DispatchOrderData {
  fulfillmentType?: string
  deliveryAddress?: { instructions?: string } | null
  guestPhone?: string
  guestName?: string
  tip?: number
  doordashQuoteId?: string
  doordashDeliveryId?: string
  doordashTrackingUrl?: string
}

function parseDropoffEstimated(iso: string | undefined): Timestamp | null {
  if (!iso) return null
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null
  return Timestamp.fromDate(date)
}

export async function dispatchOrderToDoorDash(orderId: string) {
  const orderSnap = await db.collection('orders').doc(orderId).get()
  if (!orderSnap.exists) throw new functions.https.HttpsError('not-found', 'Order not found')

  const order = orderSnap.data() as DispatchOrderData
  if (order.fulfillmentType !== 'delivery') {
    throw new functions.https.HttpsError('failed-precondition', 'Order is not delivery')
  }
  if (!order.deliveryAddress) {
    throw new functions.https.HttpsError('failed-precondition', 'Missing delivery address')
  }

  const existingDeliveryId = String(order.doordashDeliveryId ?? '').trim()
  if (existingDeliveryId && String(order.doordashTrackingUrl ?? '').trim()) {
    return { success: true, trackingUrl: order.doordashTrackingUrl ?? '' }
  }

  const quoteId = String(order.doordashQuoteId ?? '').trim()
  if (!quoteId) {
    throw new functions.https.HttpsError(
      'failed-precondition',
      'Missing DoorDash quote. Customer must re-checkout for delivery.',
    )
  }

  const phone = normalizeUsPhone(String(order.guestPhone ?? ''))
  if (!isValidUsPhone(phone)) {
    throw new functions.https.HttpsError(
      'failed-precondition',
      'Customer phone number is required for DoorDash delivery.',
    )
  }

  const acceptBody: Record<string, unknown> = {
    tip: Number(order.tip ?? 0),
    dropoff_phone_number: phone,
  }

  const resp = await doorDashRequest(
    `/drive/v2/quotes/${encodeURIComponent(quoteId)}/accept`,
    { method: 'POST', body: acceptBody },
  )

  if (!resp.ok) {
    const errorBody = await readDoorDashError(resp)
    logDoorDashFailure('DoorDash accept quote failed', resp, errorBody)
    throw new functions.https.HttpsError(
      'failed-precondition',
      userFacingDoorDashError(resp.status, errorBody),
    )
  }

  const result = (await resp.json()) as {
    external_delivery_id?: string
    tracking_url?: string
    support_reference?: string
    dropoff_time_estimated?: string
  }

  const externalDeliveryId = String(result.external_delivery_id ?? quoteId)
  const trackingUrl = result.tracking_url ?? ''
  const supportReference = result.support_reference != null ? String(result.support_reference) : ''
  const estimatedDeliveryTime = parseDropoffEstimated(result.dropoff_time_estimated)

  await db.collection('orders').doc(orderId).update({
    doordashDeliveryId: externalDeliveryId,
    doordashTrackingUrl: trackingUrl,
    ...(supportReference ? { doordashSupportId: supportReference } : {}),
    ...(estimatedDeliveryTime ? { estimatedDeliveryTime } : {}),
    doordashDispatchError: FieldValue.delete(),
    updatedAt: FieldValue.serverTimestamp(),
  })

  return { success: true, trackingUrl, supportReference }
}

export const doordashDispatch = functions.https.onCall(async (request) => {
  const { auth, data } = request
  if (!auth) throw new functions.https.HttpsError('unauthenticated', 'Must be signed in')
  const { orderId } = data as { orderId?: string }
  if (!orderId) throw new functions.https.HttpsError('invalid-argument', 'orderId is required')
  return dispatchOrderToDoorDash(orderId)
})
