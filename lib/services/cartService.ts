export const TAX_RATE = 0.06
export const SERVICE_FEE_RATE = 0.03

export interface OrderTotalsInput {
  subtotal: number
  tip?: number
  promoDiscount?: number
  loyaltyPointsToRedeem?: number
  giftCardAmount?: number
}

export function calculateTax(subtotal: number): number {
  return Math.round(subtotal * TAX_RATE)
}

export function calculateServiceFee(subtotal: number): number {
  return Math.round(subtotal * SERVICE_FEE_RATE)
}

export function calculateOrderTotal(input: OrderTotalsInput): number {
  const {
    subtotal,
    tip = 0,
    promoDiscount = 0,
    loyaltyPointsToRedeem = 0,
    giftCardAmount = 0,
  } = input

  const tax = calculateTax(subtotal)
  const serviceFee = calculateServiceFee(subtotal)
  const total =
    subtotal + tax + serviceFee + tip - promoDiscount - loyaltyPointsToRedeem - giftCardAmount

  return Math.max(0, total)
}
