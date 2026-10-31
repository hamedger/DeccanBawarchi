import * as functions from 'firebase-functions/v2'
import { doordashAdapter } from './doordashAdapter'
import { applyDeliveryStatusUpdate } from './applyDeliveryStatusUpdate'

// NOTE: DoorDash Drive supports webhook signature verification on some account tiers
// (a separate signing secret from the JWT credentials). The prior implementation of this
// endpoint didn't verify it, and this restore keeps that as-is — revisit if DoorDash's
// dashboard exposes a signing secret for this account before going to production.
export const doordashWebhook = functions.https.onRequest(async (req, res) => {
  const event = doordashAdapter.mapWebhookEvent(req.body)
  if (!event) {
    res.sendStatus(200)
    return
  }

  await applyDeliveryStatusUpdate(event)
  res.sendStatus(200)
})
