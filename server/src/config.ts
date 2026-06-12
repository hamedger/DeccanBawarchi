function optional(name: string): string | undefined {
  const value = process.env[name]?.trim()
  return value || undefined
}

export const config = {
  port: Number(process.env.PORT ?? 3001),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  corsAllowedOrigins: (process.env.CORS_ALLOWED_ORIGINS ?? 'http://localhost:8081')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),

  clover: {
    apiBaseUrl: process.env.CLOVER_API_BASE_URL?.trim() || 'https://api.clover.com',
    tipsEnabled: process.env.CLOVER_TIPS_ENABLED === 'true',
    successUrl: optional('CLOVER_SUCCESS_URL'),
    failureUrl: optional('CLOVER_FAILURE_URL'),
  },
}
