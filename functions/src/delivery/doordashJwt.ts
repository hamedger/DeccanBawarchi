import * as jwt from 'jsonwebtoken'
import { doordashDeveloperId, doordashKeyId, doordashSigningSecret } from './doordashConfig'

/** DoorDash Drive JWT per https://developer.doordash.com/en-US/docs/drive/how_to/JWTs/ */
export function buildDoorDashJwt(): string {
  const developerId = doordashDeveloperId.value().trim()
  const keyId = doordashKeyId.value().trim()
  const signingSecret = doordashSigningSecret.value().trim()
  if (!developerId || !keyId || !signingSecret) {
    throw new Error(
      'DoorDash credentials are missing (DOORDASH_DEVELOPER_ID, DOORDASH_KEY_ID, DOORDASH_SIGNING_SECRET)',
    )
  }

  const now = Math.floor(Date.now() / 1000)

  return jwt.sign(
    {
      aud: 'doordash',
      iss: developerId,
      kid: keyId,
      exp: now + 300,
      iat: now,
    },
    Buffer.from(signingSecret, 'base64'),
    { algorithm: 'HS256', header: { 'dd-ver': 'DD-JWT-V1' } as unknown as jwt.JwtHeader },
  )
}
