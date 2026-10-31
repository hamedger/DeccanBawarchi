import * as crypto from 'crypto'
import * as functions from 'firebase-functions/v2'
import { uberDirectAdapter } from './uberDirectAdapter'
import { uberDirectWebhookSigningKey } from './uberDirectConfig'
import { applyDeliveryStatusUpdate } from './applyDeliveryStatusUpdate'

function isValidSignature(rawBody: Buffer, signature: string | undefined): boolean {
  const key = uberDirectWebhookSigningKey.value().trim()
  if (!key || !signature) return false
  const expected = crypto.createHmac('sha256', key).update(rawBody).digest('hex')
  const a = Buffer.from(expected)
  const b = Buffer.from(signature)
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

export const uberDirectWebhook = functions.https.onRequest(
  { secrets: [uberDirectWebhookSigningKey] },
  async (req, res) => {
    const signature = req.header('x-uber-signature')
    const rawBody = Buffer.isBuffer(req.rawBody) ? req.rawBody : Buffer.from('')

    if (!isValidSignature(rawBody, signature)) {
      res.status(401).json({ error: 'Invalid signature' })
      return
    }

    const event = uberDirectAdapter.mapWebhookEvent(req.body)
    if (!event) {
      res.sendStatus(200)
      return
    }

    await applyDeliveryStatusUpdate(event)
    res.sendStatus(200)
  },
)
