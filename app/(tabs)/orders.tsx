import React, { useEffect } from 'react'
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useOrders } from '../../hooks/useOrders'
import { useOrderStore } from '../../store/orderStore'
import { useAuthStore } from '../../store/authStore'
import { Order, OrderStatus } from '../../types/order'
import { colors, spacing, borderRadius, fonts } from '../../constants/theme'
import { Button } from '../../components/ui/Button'

const STATUS_LABELS: Record<OrderStatus, string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  preparing: 'Preparing',
  ready: 'Ready',
  picked_up: 'Picked Up',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
}

const STATUS_COLORS: Record<OrderStatus, string> = {
  pending: colors.whiteMuted,
  confirmed: colors.gold,
  preparing: colors.goldLight,
  ready: '#4fc3f7',
  picked_up: '#ab47bc',
  delivered: colors.greenLight,
  cancelled: colors.error,
}

function OrderCard({ order }: { order: Order }) {
  const router = useRouter()
  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => router.push(`/order/${order.id}` as any)}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.orderId}>#{order.id.slice(-6).toUpperCase()}</Text>
        <View style={[styles.statusChip, { borderColor: STATUS_COLORS[order.status] + '66' }]}>
          <Text style={[styles.statusText, { color: STATUS_COLORS[order.status] }]}>
            {STATUS_LABELS[order.status]}
          </Text>
        </View>
      </View>
      <Text style={styles.items}>{order.items.map((i) => i.name).join(', ')}</Text>
      <View style={styles.cardFooter}>
        <Text style={styles.total}>${(order.total / 100).toFixed(2)}</Text>
        <Text style={styles.date}>
          {order.createdAt?.toDate?.()?.toLocaleDateString?.() ?? ''}
        </Text>
      </View>
    </TouchableOpacity>
  )
}

export default function OrdersScreen() {
  const router = useRouter()
  const { firebaseUser } = useAuthStore()
  const { orderHistory } = useOrderStore()
  useOrders()

  if (!firebaseUser) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyTitle}>Sign in to view orders</Text>
        <Button label="Sign In" onPress={() => router.push('/(auth)/login' as any)} style={{ marginTop: 16 }} />
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <FlatList
        style={styles.listView}
        data={orderHistory}
        keyExtractor={(o) => o.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => <OrderCard order={item} />}
        ListEmptyComponent={
          <View style={styles.centered}>
            <Text style={styles.emptyIcon}>📋</Text>
            <Text style={styles.emptyTitle}>No orders yet</Text>
            <Text style={styles.emptyText}>Your order history will appear here</Text>
          </View>
        }
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  listView: { flex: 1, backgroundColor: colors.background },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    backgroundColor: colors.background,
  },
  list: {
    flexGrow: 1,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.lg,
  },
  card: {
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: spacing.lg,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  orderId: { fontFamily: fonts.sansMedium, color: colors.gold, fontSize: 14 },
  statusChip: {
    borderWidth: 1,
    borderRadius: borderRadius.sm,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  statusText: { fontFamily: fonts.sansMedium, fontSize: 11 },
  items: { fontFamily: fonts.sans, color: colors.whiteMuted, fontSize: 13, marginBottom: 8, lineHeight: 18 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between' },
  total: { fontFamily: fonts.serif, color: colors.white, fontSize: 16 },
  date: { fontFamily: fonts.sans, color: colors.whiteMuted, fontSize: 12 },
  emptyIcon: { fontSize: 52, marginBottom: spacing.md },
  emptyTitle: { fontFamily: fonts.serif, color: colors.white, fontSize: 20, marginBottom: 8 },
  emptyText: { fontFamily: fonts.sans, color: colors.whiteMuted, fontSize: 14, textAlign: 'center' },
})
