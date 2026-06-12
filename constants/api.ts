export function getApiUrl(): string {
  const url = process.env.EXPO_PUBLIC_API_URL?.trim()
  if (!url) {
    throw new Error('Payment is not configured. Set EXPO_PUBLIC_API_URL.')
  }
  return url.replace(/\/$/, '')
}

export function isApiConfigured(): boolean {
  return Boolean(process.env.EXPO_PUBLIC_API_URL?.trim())
}
