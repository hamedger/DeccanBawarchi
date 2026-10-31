import * as functions from 'firebase-functions/v2'
import { computeDeliveryFee } from './deliveryPricing'
import { db, FieldValue } from '../db'
import { getActiveProviderAdapter, getActiveProviderId } from './activeProvider'
import { doordashSecrets } from './doordashConfig'
import { uberDirectSecrets } from './uberDirectConfig'
import { DeliveryQuoteItemInput } from './providerAdapter'

const DEFAULT_ETA_MINUTES = 35
/** Quote records are single-use and short-lived — matches the ~15 min expiry most couriers quote against. */
const QUOTE_TTL_MS = 20 * 60 * 1000

interface DeliveryQuoteRequestData {
  dropoffStreet?: string
  dropoffCity?: string
  dropoffState?: string
  dropoffZip?: string
  dropoffUnit?: string
  dropoffPhoneNumber?: string
  dropoffContactGivenName?: string
  orderValue?: number
  items?: DeliveryQuoteItemInput[]
  pickupTime?: string
  locationId?: string
}

export const deliveryQuote = functions.https.onCall(
  { secrets: [...doordashSecrets, ...uberDirectSecrets] },
  async (request) => {
    const { auth, data } = request
    if (!auth) throw new functions.https.HttpsError('unauthenticated', 'Must be signed in')

    const {
      dropoffStreet,
      dropoffCity,
      dropoffState = 'MI',
      dropoffZip,
      dropoffUnit,
      dropoffPhoneNumber = '',
      dropoffContactGivenName = 'Customer',
      orderValue = 0,
      items = [],
      pickupTime,
      locationId,
    } = data as DeliveryQuoteRequestData

    const street = String(dropoffStreet ?? '').trim()
    const city = String(dropoffCity ?? '').trim()
    const zip = String(dropoffZip ?? '').trim()

    if (!street || !city || !zip) {
      throw new functions.https.HttpsError('invalid-argument', 'Complete delivery address is required')
    }

    const adapter = getActiveProviderAdapter()

    // Self-delivery — unchanged from before this file was generalized.
    if (!adapter) {
      try {
        const { feeCents, distanceMiles } = await computeDeliveryFee({
          locationId: String(locationId ?? 'northville-mi'),
          deliveryAddress: { street, city, state: String(dropoffState ?? 'MI').trim(), zip },
        })

        return {
          fee: feeCents,
          distanceMiles: Math.round(distanceMiles * 10) / 10,
          etaMinutes: DEFAULT_ETA_MINUTES,
          currency: 'USD',
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to get a delivery quote'
        throw new functions.https.HttpsError('failed-precondition', message)
      }
    }

    // Dispatched courier — quote via the active provider, persist the fee for
    // createPendingOrder to verify against so the client can never spoof deliveryFee.
    try {
      const quote = await adapter.getQuote({
        locationId: String(locationId ?? 'northville-mi'),
        dropoffStreet: street,
        dropoffCity: city,
        dropoffState: String(dropoffState ?? 'MI').trim(),
        dropoffZip: zip,
        dropoffUnit: dropoffUnit?.trim() || undefined,
        dropoffPhoneNumber: String(dropoffPhoneNumber ?? '').trim(),
        dropoffContactGivenName: String(dropoffContactGivenName ?? 'Customer').trim(),
        orderValue: Number(orderValue ?? 0),
        items: Array.isArray(items) ? items : [],
        pickupTime,
      })

      await db.collection('deliveryQuotes').doc(quote.externalQuoteId).set({
        provider: getActiveProviderId(),
        feeCents: quote.feeCents,
        locationId: String(locationId ?? 'northville-mi'),
        createdAt: FieldValue.serverTimestamp(),
      })

      return {
        fee: quote.feeCents,
        etaMinutes: quote.etaMinutes,
        externalQuoteId: quote.externalQuoteId,
        currency: 'USD',
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to get a delivery quote'
      throw new functions.https.HttpsError('failed-precondition', message)
    }
  },
)

export const DELIVERY_QUOTE_TTL_MS = QUOTE_TTL_MS
