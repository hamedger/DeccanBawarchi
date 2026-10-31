import { defineSecret } from 'firebase-functions/params'

export const doordashDeveloperId = defineSecret('DOORDASH_DEVELOPER_ID')
export const doordashKeyId = defineSecret('DOORDASH_KEY_ID')
export const doordashSigningSecret = defineSecret('DOORDASH_SIGNING_SECRET')

export const doordashSecrets = [doordashDeveloperId, doordashKeyId, doordashSigningSecret]
