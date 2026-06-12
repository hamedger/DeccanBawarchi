import { Router } from 'express'
import { assertAnyCloverLocationConfigured, getCloverLocationByMerchantId, getCloverLocationConfig } from '../lib/cloverLocations'
import { requireAuth, AuthedRequest } from '../middleware/auth'
import { createCheckoutSession } from '../services/cloverClient'
import {
  attachCheckoutSession,
  createPendingOrder,
  markOrderDeclinedByCheckoutSession,
  markOrderPaidByCheckoutSession,
} from '../services/orderService'
import { parseCloverWebhook, verifyCloverSignature } from '../services/cloverWebhook'

export const cloverRouter = Router()

cloverRouter.post('/checkout', requireAuth, async (req: AuthedRequest, res) => {
  try {
    assertAnyCloverLocationConfigured()

    const uid = req.uid
    if (!uid) {
      res.status(401).json({ error: 'Unauthorized' })
      return
    }

    const {
      items,
      subtotal,
      tax,
      serviceFee,
      deliveryFee = 0,
      tip = 0,
      promoCode = '',
      promoDiscount = 0,
      loyaltyPointsUsed = 0,
      giftCardAmount = 0,
      total,
      fulfillmentType,
      deliveryAddress = null,
      locationId,
      notes = '',
      customerName = '',
      customerPhone = '',
    } = req.body ?? {}

    if (!locationId || typeof locationId !== 'string') {
      res.status(400).json({ error: 'locationId is required' })
      return
    }

    const clover = getCloverLocationConfig(locationId)

    const pending = await createPendingOrder({
      cloverMerchantId: clover.merchantId,
      uid,
      customerEmail: req.userEmail,
      customerName,
      customerPhone,
      items,
      subtotal,
      tax,
      serviceFee,
      deliveryFee,
      tip,
      promoCode,
      promoDiscount,
      loyaltyPointsUsed,
      giftCardAmount,
      total,
      fulfillmentType,
      deliveryAddress,
      locationId,
      notes,
    })

    const session = await createCheckoutSession({
      clover,
      customer: pending.customer,
      lineItems: pending.lineItems,
      orderId: pending.orderId,
    })

    await attachCheckoutSession(pending.orderId, session.checkoutSessionId)

    res.json({
      orderId: pending.orderId,
      href: session.href,
      checkoutSessionId: session.checkoutSessionId,
      expirationTime: session.expirationTime,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not start checkout'
    const status =
      message.includes('totals') ||
      message.includes('empty') ||
      message.includes('loyalty') ||
      message.includes('profile')
        ? 400
        : 500
    res.status(status).json({ error: message })
  }
})

cloverRouter.post('/webhook', async (req, res) => {
  try {
    assertAnyCloverLocationConfigured()

    const rawBody = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : ''
    const signature = req.header('Clover-Signature') ?? req.header('clover-signature') ?? undefined

    const event = parseCloverWebhook(rawBody)
    if (!event) {
      res.status(400).json({ error: 'Invalid webhook payload' })
      return
    }

    const cloverLocation = event.merchantId
      ? getCloverLocationByMerchantId(event.merchantId)
      : null
    if (!cloverLocation) {
      res.status(400).json({ error: 'Unknown Clover merchant' })
      return
    }

    if (!verifyCloverSignature(rawBody, signature, cloverLocation.webhookSecret)) {
      res.status(400).json({ error: 'Invalid Clover signature' })
      return
    }

    if (event.type !== 'PAYMENT' || !event.checkoutSessionId) {
      res.sendStatus(200)
      return
    }

    if (event.status === 'APPROVED') {
      await markOrderPaidByCheckoutSession(event.checkoutSessionId, event.paymentId)
    } else if (event.status === 'DECLINED') {
      await markOrderDeclinedByCheckoutSession(event.checkoutSessionId)
    }

    res.sendStatus(200)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Webhook handler failed'
    res.status(500).json({ error: message })
  }
})
