import React, { useEffect, useMemo, useState } from 'react'
import { View, Text, StyleSheet, ScrollView } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { AdminGate } from '../../components/admin/AdminGate'
import { useAdminOrders } from '../../hooks/useAdminOrders'
import { isPaidOrder } from '../../lib/admin/orderAdmin'
import { Order, OrderStatus } from '../../types/order'
import { colors, spacing, borderRadius, fonts } from '../../constants/theme'

const COLUMNS: { key: string; label: string; statuses: OrderStatus[]; accent: string }[] = [
  { key: 'new', label: 'New', statuses: ['placed', 'confirmed'], accent: colors.gold },
  { key: 'preparing', label: 'Preparing', statuses: ['preparing'], accent: colors.goldLight },
  { key: 'ready', label: 'Ready', statuses: ['ready'], accent: colors.greenLight },
]

const STALE_MINUTES = 15

function elapsedMinutes(order: Order, now: Date): number {
  const created = order.createdAt?.toDate?.()
  if (!created) return 0
  return Math.max(0, Math.floor((now.getTime() - created.getTime()) / 60000))
}

function OrderTicket({ order, now }: { order: Order; now: Date }) {
  const minutes = elapsedMinutes(order, now)
  const shortId = order.id.slice(-6).toUpperCase()
  const stale = minutes >= STALE_MINUTES

  return (
    <View style={[styles.ticket, stale && styles.ticketStale]}>
      <View style={styles.ticketHeader}>
        <View style={styles.ticketHeaderLeft}>
          <Ionicons
            name={order.fulfillmentType === 'delivery' ? 'bicycle' : 'bag-handle'}
            size={18}
            color={colors.gold}
          />
          <Text style={styles.ticketId}>#{shortId}</Text>
        </View>
        <Text style={[styles.ticketTime, stale && styles.ticketTimeStale]}>
          {minutes}m ago
        </Text>
      </View>

      {order.guestName ? <Text style={styles.ticketCustomer}>{order.guestName}</Text> : null}

      <View style={styles.itemList}>
        {order.items.map((item, idx) => (
          <View key={`${item.menuItemId}-${idx}`} style={styles.itemRow}>
            <Text style={styles.itemQty}>{item.quantity}×</Text>
            <View style={styles.itemTextWrap}>
              <Text style={styles.itemName}>{item.name}</Text>
              {item.instructions ? (
                <Text style={styles.itemInstructions}>{item.instructions}</Text>
              ) : null}
            </View>
          </View>
        ))}
      </View>

      {order.notes?.trim() ? (
        <Text style={styles.ticketNotes}>Note: {order.notes.trim()}</Text>
      ) : null}
    </View>
  )
}

function KitchenBoard({ locationId }: { locationId: string }) {
  const { orders, loading } = useAdminOrders(150, locationId)
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(interval)
  }, [])

  const columns = useMemo(() => {
    const active = orders.filter((o) => isPaidOrder(o))
    return COLUMNS.map((col) => ({
      ...col,
      orders: active
        .filter((o) => col.statuses.includes(o.status))
        .sort((a, b) => (a.createdAt?.toMillis?.() ?? 0) - (b.createdAt?.toMillis?.() ?? 0)),
    }))
  }, [orders])

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Kitchen Display</Text>
        <Text style={styles.headerClock}>
          {now.toLocaleTimeString('en-US', {
            timeZone: 'America/Detroit',
            hour: 'numeric',
            minute: '2-digit',
          })}
        </Text>
      </View>

      <View style={styles.board}>
        {columns.map((col) => (
          <View key={col.key} style={styles.column}>
            <View style={[styles.columnHeader, { borderColor: col.accent }]}>
              <Text style={[styles.columnTitle, { color: col.accent }]}>{col.label}</Text>
              <Text style={styles.columnCount}>{col.orders.length}</Text>
            </View>
            <ScrollView style={styles.columnScroll} showsVerticalScrollIndicator={false}>
              {col.orders.length === 0 && !loading ? (
                <Text style={styles.emptyText}>No orders</Text>
              ) : null}
              {col.orders.map((order) => (
                <OrderTicket key={order.id} order={order} now={now} />
              ))}
            </ScrollView>
          </View>
        ))}
      </View>
    </View>
  )
}

export default function KitchenDisplayScreen() {
  const { locationId } = useLocalSearchParams<{ locationId: string }>()

  return (
    <AdminGate>
      <KitchenBoard locationId={locationId ?? 'farmington-hills-mi'} />
    </AdminGate>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  headerTitle: {
    fontFamily: fonts.serif,
    color: colors.white,
    fontSize: 28,
  },
  headerClock: {
    fontFamily: fonts.display,
    color: colors.gold,
    fontSize: 28,
  },
  board: {
    flex: 1,
    flexDirection: 'row',
  },
  column: {
    flex: 1,
    borderRightWidth: 1,
    borderColor: colors.border,
  },
  columnHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 2,
  },
  columnTitle: {
    fontFamily: fonts.sansBold,
    fontSize: 22,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  columnCount: {
    fontFamily: fonts.sansBold,
    color: colors.whiteMuted,
    fontSize: 20,
  },
  columnScroll: {
    flex: 1,
    padding: spacing.md,
  },
  emptyText: {
    fontFamily: fonts.sans,
    color: colors.whiteMuted,
    fontSize: 14,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
  ticket: {
    backgroundColor: colors.backgroundCard,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  ticketStale: {
    borderColor: colors.error,
  },
  ticketHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  ticketHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  ticketId: {
    fontFamily: fonts.sansBold,
    color: colors.white,
    fontSize: 18,
  },
  ticketTime: {
    fontFamily: fonts.sansBold,
    color: colors.whiteMuted,
    fontSize: 14,
  },
  ticketTimeStale: {
    color: colors.error,
  },
  ticketCustomer: {
    fontFamily: fonts.sans,
    color: colors.gold,
    fontSize: 14,
    marginBottom: spacing.sm,
  },
  itemList: {
    gap: spacing.xs,
  },
  itemRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  itemQty: {
    fontFamily: fonts.sansBold,
    color: colors.gold,
    fontSize: 16,
    minWidth: 28,
  },
  itemTextWrap: {
    flex: 1,
  },
  itemName: {
    fontFamily: fonts.sans,
    color: colors.white,
    fontSize: 16,
  },
  itemInstructions: {
    fontFamily: fonts.sans,
    color: colors.whiteMuted,
    fontSize: 12,
    fontStyle: 'italic',
  },
  ticketNotes: {
    fontFamily: fonts.sans,
    color: colors.goldLight,
    fontSize: 12,
    marginTop: spacing.sm,
    fontStyle: 'italic',
  },
})
