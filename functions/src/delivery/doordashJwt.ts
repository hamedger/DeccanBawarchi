import * as jwt from 'jsonwebtoken'

/** DoorDash Drive JWT per https://developer.doordash.com/en-US/docs/drive/how_to/JWTs/ */
export function buildDoorDashJwt(): string {
  const developerId = process.env.DOORDASH_DEVELOPER_ID
  const keyId = process.env.DOORDASH_KEY_ID
  const signingSecret = process.env.DOORDASH_SIGNING_SECRET
  if (!developerId || !keyId || !signingSecret) {
    throw new Error('DoorDash credentials are missing (DOORDASH_DEVELOPER_ID, DOORDASH_KEY_ID, DOORDASH_SIGNING_SECRET)')
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
