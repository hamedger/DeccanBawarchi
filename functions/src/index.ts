// Export all Cloud Functions
export { createOrder } from './orders/createOrder'
export { confirmCloverOrder } from './orders/confirmCloverOrder'
export { updateOrderStatus } from './orders/updateOrderStatus'
export { notifyStaffOnOrder } from './orders/notifyStaffOnOrder'
export { awardLoyaltyOnDelivery } from './loyalty/awardOnDelivery'
export { onUserCreated } from './auth/onUserCreated'
export { deliveryQuote } from './delivery/deliveryQuote'
export { notifyCustomerOnDelivered } from './delivery/notifyCustomerOnDelivered'
export { stripeWebhook } from './payments/stripeWebhook'
export { getAIRecommendations } from './ai/recommendations'
export {
  generateDailyGrowthInsights,
  refreshGrowthInsights,
  askGrowthCopilot,
} from './ai/growthCopilot'
export { getBuffetStatus } from './buffet/getBuffetStatus'
export { openLunch, closeLunch, openDinner, closeDinner } from './buffet/scheduler'
