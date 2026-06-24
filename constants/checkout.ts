export const MOCK_DELIVERY_FEE_CENTS = 599
export const MOCK_DELIVERY_ETA_MINUTES = 35
export const MOCK_PICKUP_ETA_MINUTES = 20

export const TIP_PERCENT_OPTIONS = [15, 20, 30] as const
export type TipPercent = (typeof TIP_PERCENT_OPTIONS)[number]

export const CONTENT_MAX_WIDTH = 640
