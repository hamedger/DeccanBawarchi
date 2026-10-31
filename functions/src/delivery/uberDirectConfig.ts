import { defineSecret } from 'firebase-functions/params'

// Names must match exactly — the official `uber-direct` SDK reads
// UBER_DIRECT_CLIENT_ID / UBER_DIRECT_CLIENT_SECRET / UBER_DIRECT_CUSTOMER_ID
// directly from process.env itself (confirmed from the package's compiled source);
// Firebase Functions v2 injects secrets into process.env under their exact secret
// name when a function declares them in its `secrets` option, so no plumbing needed
// beyond declaring these on each function that uses the SDK.
export const uberDirectClientId = defineSecret('UBER_DIRECT_CLIENT_ID')
export const uberDirectClientSecret = defineSecret('UBER_DIRECT_CLIENT_SECRET')
export const uberDirectCustomerId = defineSecret('UBER_DIRECT_CUSTOMER_ID')
/** Separate signing key for the delivery webhook (created in the Uber Direct dashboard), not the OAuth client secret. */
export const uberDirectWebhookSigningKey = defineSecret('UBER_DIRECT_WEBHOOK_SIGNING_KEY')

export const uberDirectSecrets = [
  uberDirectClientId,
  uberDirectClientSecret,
  uberDirectCustomerId,
]
