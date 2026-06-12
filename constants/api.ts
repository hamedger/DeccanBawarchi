/** Render Clover checkout API — override with EXPO_PUBLIC_API_URL for local/staging. */
export const DEFAULT_API_URL = 'https://deccanbawarchi-api.onrender.com'

function resolveApiUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL?.trim()
  return fromEnv || DEFAULT_API_URL
}

export function getApiUrl(): string {
  return resolveApiUrl().replace(/\/$/, '')
}

export function isApiConfigured(): boolean {
  return resolveApiUrl().length > 0
}
