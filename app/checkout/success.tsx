import React, { useEffect } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useCartStore } from '../../store/cartStore'
import { Button } from '../../components/ui/Button'
import { HomeButton } from '../../components/navigation/HomeButton'
import { clearCheckoutContext, confirmCloverOrderAfterRedirect, readCheckoutContext } from '../../lib/services/cloverCheckout'
import { CONTENT_MAX_WIDTH } from '../../constants/checkout'
import { colors, spacing, borderRadius, fonts } from '../../constants/theme'

export default function CheckoutSuccessScreen() {
  const router = useRouter()
  const clearCart = useCartStore((s) => s.clearCart)
  const params = useLocalSearchParams<{
    orderId?: string
    session_id?: string
    fulfillment?: string
    eta?: string
    address?: string
    pickupSchedule?: string
    total?: string
  }>()

  useEffect(() => {
    clearCart()
    clearCheckoutContext()
  }, [clearCart])

  useEffect(() => {
    const checkoutSessionId = params.session_id?.trim()
    if (!checkoutSessionId) return

    void confirmCloverOrderAfterRedirect(checkoutSessionId, params.orderId?.trim()).finally(() => {
      router.replace('/(tabs)/' as never)
    })
  }, [params.orderId, params.session_id, router])

  const saved = readCheckoutContext()
  const isDelivery = (params.fulfillment ?? saved?.fulfillment) === 'delivery'
  const orderId = params.orderId ?? `DB${Date.now().toString().slice(-6)}`
  const displayOrderId = orderId.length > 6 ? orderId.slice(-6).toUpperCase() : orderId
  const total = params.total ? Number(params.total) : saved?.total ? Number(saved.total) : 0
  const address = params.address ?? saved?.address ?? '—'
  const pickupSchedule = params.pickupSchedule ?? saved?.pickupSchedule

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <HomeButton />
      </View>
      <View style={styles.inner}>
        <View style={styles.iconCircle}>
          <Ionicons name="checkmark" size={36} color={colors.background} />
        </View>

        <Text style={styles.title}>Payment Confirmed!</Text>
        <Text style={styles.orderId}>Order #{displayOrderId}</Text>

        <View style={styles.detailCard}>
          <DetailRow
            icon={isDelivery ? 'bicycle' : 'bag-handle'}
            iconColor={isDelivery ? '#FF3008' : colors.gold}
            label={isDelivery ? 'DoorDash Delivery' : 'Restaurant Pickup'}
            value={address}
          />
          <DetailRow
            icon="time-outline"
            label={isDelivery ? 'Estimated delivery' : 'Scheduled pickup'}
            value={
              isDelivery
                ? `~${params.eta ?? '30'} minutes`
                : (pickupSchedule ?? `~${params.eta ?? '20'} minutes`)
            }
          />
          <DetailRow
            icon="card-outline"
            label="Total charged"
            value={`$${(total / 100).toFixed(2)}`}
            highlight
          />
        </View>

        {isDelivery ? (
          <Text style={styles.hint}>
            A DoorDash driver will be dispatched when delivery launches.
          </Text>
        ) : (
          <Text style={styles.hint}>
            We&apos;ll notify you when your order is ready for pickup.
          </Text>
        )}

        <Button
          label="Back to Menu"
          onPress={() => router.replace('/(tabs)/menu' as never)}
          fullWidth
          size="lg"
          style={{ marginTop: spacing.lg }}
        />
        <Button
          label="Track Order"
          onPress={() => router.replace(`/order/${orderId}` as never)}
          variant="secondary"
          fullWidth
          style={{ marginTop: spacing.sm }}
        />
        <Button
          label="View All Orders"
          onPress={() => router.replace('/(tabs)/orders' as never)}
          variant="ghost"
          fullWidth
          style={{ marginTop: spacing.sm }}
        />
      </View>
    </View>
  )
}

function DetailRow({
  icon,
  iconColor = colors.gold,
  label,
  value,
  highlight,
}: {
  icon: keyof typeof Ionicons.glyphMap
  iconColor?: string
  label: string
  value: string
  highlight?: boolean
}) {
  return (
    <View style={styles.detailRow}>
      <Ionicons name={icon} size={18} color={iconColor} />
      <View style={styles.detailBody}>
        <Text style={styles.detailLabel}>{label}</Text>
        <Text style={[styles.detailValue, highlight && styles.detailHighlight]}>{value}</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  topBar: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.md,
    zIndex: 1,
  },
  inner: {
    width: '100%',
    maxWidth: CONTENT_MAX_WIDTH,
    alignItems: 'center',
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  title: {
    fontFamily: fonts.serif,
    color: colors.gold,
    fontSize: 28,
    marginBottom: 4,
  },
  orderId: {
    fontFamily: fonts.sansBold,
    color: colors.whiteMuted,
    fontSize: 14,
    marginBottom: spacing.lg,
  },
  detailCard: {
    width: '100%',
    backgroundColor: colors.backgroundCard,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.md,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  detailBody: { flex: 1, gap: 2 },
  detailLabel: {
    fontFamily: fonts.sans,
    color: colors.whiteMuted,
    fontSize: 12,
  },
  detailValue: {
    fontFamily: fonts.sansMedium,
    color: colors.white,
    fontSize: 14,
    lineHeight: 20,
  },
  detailHighlight: {
    fontFamily: fonts.sansBold,
    color: colors.gold,
    fontSize: 18,
  },
  hint: {
    fontFamily: fonts.sans,
    color: colors.whiteMuted,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
    marginTop: spacing.md,
  },
})
