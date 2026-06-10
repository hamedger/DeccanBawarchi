import React, { useMemo, useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native'
import { useAdminOrders } from '../../hooks/useAdminOrders'
import {
  nextOrderStatus,
  ORDER_STATUS_LABELS,
  updateAdminOrderStatus,
} from '../../lib/admin/orderAdmin'
import { formatCents, formatOrderTime } from '../../lib/admin/stats'
import { Order, OrderStatus } from '../../types/order'
import { OrderFilterBar, OrderFilter } from '../../components/admin/OrderFilterBar'
import { colors, spacing, borderRadius, fonts } from '../../constants/theme'
import { Button } from '../../components/ui/Button'

function statusColor(status: OrderStatus): string {
  switch (status) {
    case 'pending':
      return colors.goldLight
    case 'confirmed':
    case 'preparing':
      return colors.gold
    case 'ready':
      return colors.greenLight
    case 'picked_up':
      return colors.green
    case 'delivered':
      return colors.whiteMuted
    case 'cancelled':
      return colors.error
    default:
      return colors.white
  }
}

function OrderCard({ order }: { order: Order }) {
  const [updating, setUpdating] = useState(false)
  const next = nextOrderStatus(order.status)

  const advance = async () => {
    if (!next) return
    setUpdating(true)
    try {
      await updateAdminOrderStatus(order.id, next)
    } catch (e) {
      Alert.alert('Update failed', e instanceof Error ? e.message : 'Could not update order')
    } finally {
      setUpdating(false)
    }
  }

  const cancel = async () => {
    setUpdating(true)
    try {
      await updateAdminOrderStatus(order.id, 'cancelled')
    } catch (e) {
      Alert.alert('Update failed', e instanceof Error ? e.message : 'Could not cancel order')
    } finally {
      setUpdating(false)
    }
  }

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View>
          <Text style={styles.orderId}>#{order.id.slice(-6).toUpperCase()}</Text>
          <Text style={styles.orderTime}>{formatOrderTime(order.createdAt)}</Text>
        </View>
        <View style={[styles.statusPill, { borderColor: statusColor(order.status) }]}>
          <Text style={[styles.statusText, { color: statusColor(order.status) }]}>
            {ORDER_STATUS_LABELS[order.status]}
          </Text>
        </View>
      </View>

      <Text style={styles.fulfillment}>
        {order.fulfillmentType === 'delivery' ? 'Delivery' : 'Pickup'}
        {order.guestPhone ? ` · ${order.guestPhone}` : ''}
      </Text>

      {order.items.map((item, idx) => (
        <Text key={`${item.menuItemId}-${idx}`} style={styles.itemLine}>
          {item.quantity}× {item.name}
        </Text>
      ))}

      <View style={styles.cardFooter}>
        <Text style={styles.total}>{formatCents(order.total)}</Text>
        <View style={styles.actions}>
          {order.status !== 'cancelled' && order.status !== 'delivered' && (
            <>
              {next ? (
                <Button
                  label={`Mark ${ORDER_STATUS_LABELS[next]}`}
                  size="sm"
                  onPress={advance}
                  loading={updating}
                />
              ) : null}
              <Button
                label="Cancel"
                size="sm"
                variant="ghost"
                onPress={cancel}
                disabled={updating}
              />
            </>
          )}
        </View>
      </View>
    </View>
  )
}

export default function AdminOrdersScreen() {
  const { orders, loading } = useAdminOrders()
  const [filter, setFilter] = useState<OrderFilter>('active')

  const filtered = useMemo(() => {
    if (filter === 'all') return orders
    if (filter === 'active') {
      return orders.filter((o) => !['delivered', 'cancelled'].includes(o.status))
    }
    return orders.filter((o) => o.status === filter)
  }, [orders, filter])

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.heading}>Orders</Text>
        <Text style={styles.count}>{filtered.length} shown</Text>
      </View>

      <OrderFilterBar orders={orders} filter={filter} onChange={setFilter} />

      {loading ? (
        <ActivityIndicator color={colors.gold} style={{ marginTop: spacing.xl }} />
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {filtered.length === 0 ? (
            <Text style={styles.empty}>No orders match this filter.</Text>
          ) : (
            filtered.map((order) => <OrderCard key={order.id} order={order} />)
          )}
        </ScrollView>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    gap: spacing.sm,
  },
  heading: {
    fontFamily: fonts.serif,
    color: colors.gold,
    fontSize: 28,
  },
  count: {
    fontFamily: fonts.sans,
    color: colors.whiteMuted,
    fontSize: 13,
  },
  list: {
    padding: spacing.lg,
    paddingTop: spacing.sm,
    gap: spacing.md,
    maxWidth: 900,
    alignSelf: 'center',
    width: '100%',
  },
  empty: {
    fontFamily: fonts.sans,
    color: colors.whiteMuted,
    fontSize: 14,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
  card: {
    backgroundColor: colors.backgroundCard,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  orderId: {
    fontFamily: fonts.sansBold,
    color: colors.gold,
    fontSize: 16,
  },
  orderTime: {
    fontFamily: fonts.sans,
    color: colors.whiteMuted,
    fontSize: 12,
    marginTop: 2,
  },
  statusPill: {
    borderWidth: 1,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  statusText: {
    fontFamily: fonts.sansBold,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  fulfillment: {
    fontFamily: fonts.sansMedium,
    color: colors.white,
    fontSize: 13,
  },
  itemLine: {
    fontFamily: fonts.sans,
    color: colors.whiteMuted,
    fontSize: 13,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.xs,
    gap: spacing.sm,
  },
  total: {
    fontFamily: fonts.sansBold,
    color: colors.white,
    fontSize: 16,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexShrink: 1,
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
  },
})
