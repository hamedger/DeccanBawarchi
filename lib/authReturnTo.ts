export const CHECKOUT_RETURN_PATH = '/checkout'

export function resolveAuthReturnPath(returnTo?: string | string[]): string {
  const path = Array.isArray(returnTo) ? returnTo[0] : returnTo
  if (path && path.startsWith('/')) return path
  return '/(tabs)/'
}
