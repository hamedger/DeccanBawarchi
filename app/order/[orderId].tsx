import React from 'react'
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Linking } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useOrder } from '../../hooks/useOrders'
import { useOrderStore } from '../../store/orderStore'
import { OrderStatus } from '../../types/order'
import { colors, spacing, borderRadius } from '../../constants/theme'
import { Button } from '../../components/ui/Button'
import { reorderToCart } from '../../lib/reorder'

const STEPS: { status: OrderStatus; label: string; icon: string }[] = [
  { status: 'confirmed', label: 'Order Confirmed', icon: 'checkmark-circle' },
  { status: 'preparing', label: 'Preparing', icon: 'restaurant' },
  { status: 'ready', label: 'Ready', icon: 'bag-check' },
  { status: 'picked_up', label: 'Driver Picked Up', icon: 'bicycle' },
  { status: 'delivered', label: 'Delivered', icon: 'home' },
]

const STATUS_ORDER: OrderStatus[] = ['confirmed', 'preparing', 'ready', 'picked_up', 'delivered']

export default function OrderTrackingScreen() {
  const router = useRouter()
  const { orderId } = useLocalSearchParams<{ orderId: string }>()
  const { activeOrder: order } = useOrderStore()
  useOrder(orderId)

  if (!order) {
    return (
      <View style={styles.centered}>
        <Text style={styles.loadingText}>Loading order...</Text>
      </View>
    )
  }

  const effectiveStatus = order.status === 'pending' ? 'confirmed' : order.status
  const currentIndex = STATUS_ORDER.indexOf(effectiveStatus as OrderStatus)

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.orderId}>Order #{order.id.slice(-6).toUpperCase()}</Text>
        {order.status === 'delivered' && (
          <Text style={styles.deliveredBadge}>✓ Delivered</Text>
        )}
      </View>

      {/* Status Timeline */}
      <View style={styles.timeline}>
        {STEPS.map((step, idx) => {
          const done = currentIndex >= idx
          const active = currentIndex === idx
          return (
            <View key={step.status} style={styles.timelineRow}>
              <View style={styles.timelineLeft}>
                <View style={[styles.dot, done ? styles.dotDone : styles.dotPending, active && styles.dotActive]}>
                  <Ionicons name={step.icon as any} size={14} color={done ? colors.background : colors.whiteMuted} />
                </View>
                {idx < STEPS.length - 1 && <View style={[styles.line, done && styles.lineDone]} />}
              </View>
              <Text style={[styles.stepLabel, done ? styles.stepDone : styles.stepPending]}>
                {step.label}
              </Text>
            </View>
          )
        })}
      </View>

      {/* Order Items */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Items Ordered</Text>
        {order.items.map((item, idx) => (
          <View key={idx} style={styles.itemRow}>
            <Text style={styles.itemQty}>{item.quantity}×</Text>
            <Text style={styles.itemName}>{item.name}</Text>
            <Text style={styles.itemPrice}>${((item.price * item.quantity) / 100).toFixed(2)}</Text>
          </View>
        ))}
      </View>

      {/* DoorDash Link */}
      {order.doordashTrackingUrl ? (
        <TouchableOpacity
          style={styles.trackBtn}
          onPress={() => Linking.openURL(order.doordashTrackingUrl)}
        >
          <Text style={styles.trackBtnText}>🗺 Track Driver in Real-Time</Text>
        </TouchableOpacity>
      ) : null}

      {/* Totals */}
      <View style={styles.totals}>
        <TotalsRow label="Total" value={order.total} bold />
      </View>

      <Button
        label="Reorder"
        onPress={() => {
          reorderToCart(order)
          router.push('/(tabs)/cart' as never)
        }}
        fullWidth
        size="lg"
        style={{ marginTop: spacing.lg }}
      />
    </ScrollView>
  )
}

function TotalsRow({ label, value, bold }: { label: string; value: number; bold?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
      <Text style={{ color: bold ? colors.white : colors.whiteMuted, fontSize: 14, fontWeight: bold ? '700' : '400' }}>{label}</Text>
      <Text style={{ color: bold ? colors.gold : colors.white, fontSize: 14, fontWeight: bold ? '700' : '400' }}>${(value / 100).toFixed(2)}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { color: colors.whiteMuted },
  header: { marginBottom: spacing.xl },
  orderId: { color: colors.white, fontSize: 22, fontWeight: '800' },
  deliveredBadge: { color: colors.greenLight, fontSize: 14, fontWeight: '700', marginTop: 4 },
  timeline: { marginBottom: spacing.xl },
  timelineRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  timelineLeft: { alignItems: 'center', width: 32 },
  dot: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center', borderWidth: 2,
  },
  dotDone: { backgroundColor: colors.gold, borderColor: colors.gold },
  dotPending: { backgroundColor: 'transparent', borderColor: colors.border },
  dotActive: { borderColor: colors.goldLight },
  line: { width: 2, flex: 1, minHeight: 20, backgroundColor: colors.border, marginVertical: 2 },
  lineDone: { backgroundColor: colors.gold },
  stepLabel: { flex: 1, fontSize: 14, paddingTop: 6 },
  stepDone: { color: colors.white, fontWeight: '600' },
  stepPending: { color: colors.whiteMuted },
  section: { marginBottom: spacing.lg },
  sectionTitle: { color: colors.gold, fontSize: 12, fontWeight: '700', letterSpacing: 1, marginBottom: spacing.sm },
  itemRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.border },
  itemQty: { color: colors.gold, fontWeight: '700', marginRight: 8, width: 24 },
  itemName: { flex: 1, color: colors.white, fontSize: 14 },
  itemPrice: { color: colors.whiteMuted, fontSize: 14 },
  trackBtn: {
    backgroundColor: 'rgba(212,175,55,0.1)',
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  trackBtnText: { color: colors.gold, fontWeight: '700', fontSize: 14 },
  totals: { backgroundColor: colors.backgroundCard, borderRadius: borderRadius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md },
})
