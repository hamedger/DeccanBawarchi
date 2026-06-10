import React, { useState } from 'react'
import { View, Text, ScrollView, StyleSheet, Alert } from 'react-native'
import { useRouter } from 'expo-router'
import { getFunctions, httpsCallable } from 'firebase/functions'
import app from '../../lib/firebase'
import { useCart } from '../../hooks/useCart'
import { useAuthStore } from '../../store/authStore'
import { Button } from '../../components/ui/Button'
import { colors, spacing, borderRadius } from '../../constants/theme'

export default function PaymentScreen() {
  const router = useRouter()
  const cart = useCart()
  const { firebaseUser, userProfile } = useAuthStore()
  const [loading, setLoading] = useState(false)

  const handlePlaceOrder = async () => {
    if (!firebaseUser) return
    setLoading(true)
    try {
      const functions = getFunctions(app, 'us-central1')
      const createOrder = httpsCallable(functions, 'createOrder')
      const result: any = await createOrder({
        items: cart.items,
        subtotal: cart.subtotal(),
        tax: cart.tax,
        serviceFee: cart.serviceFee,
        tip: cart.tip,
        total: cart.total,
        promoCode: cart.promoCode,
        promoDiscount: cart.promoDiscount,
        loyaltyPointsUsed: cart.loyaltyPointsToRedeem,
        giftCardAmount: cart.giftCardAmount,
        fulfillmentType: 'delivery',
        locationId: 'northville-mi',
        notes: cart.notes,
      })
      cart.clearCart()
      router.replace(`/order/${result.data.orderId}` as any)
    } catch (e: any) {
      Alert.alert('Order Failed', e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Payment</Text>

      <View style={styles.totalCard}>
        <Text style={styles.totalLabel}>Order Total</Text>
        <Text style={styles.totalAmount}>${(cart.total / 100).toFixed(2)}</Text>
      </View>

      <Text style={styles.note}>
        💳 Stripe payment integration will be completed with your API keys.
        {'\n'}Apple Pay and Google Pay will auto-appear on supported devices.
      </Text>

      <Button
        label={`Place Order · $${(cart.total / 100).toFixed(2)}`}
        onPress={handlePlaceOrder}
        loading={loading}
        fullWidth
        size="lg"
        style={{ marginTop: spacing.xl }}
      />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg },
  title: { color: colors.white, fontSize: 22, fontWeight: '800', marginBottom: spacing.lg },
  totalCard: {
    backgroundColor: colors.backgroundCard,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    padding: spacing.xl,
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  totalLabel: { color: colors.whiteMuted, fontSize: 13, fontWeight: '700', letterSpacing: 1 },
  totalAmount: { color: colors.gold, fontSize: 40, fontWeight: '800', marginTop: 8 },
  note: { color: colors.whiteMuted, fontSize: 13, lineHeight: 22, textAlign: 'center' },
})
