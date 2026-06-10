import React, { useMemo } from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { Order, OrderStatus } from '../../types/order'
import { ORDER_STATUS_LABELS } from '../../lib/admin/orderAdmin'
import { colors, spacing, borderRadius, fonts } from '../../constants/theme'

export type OrderFilter = OrderStatus | 'active' | 'all'

const STATUS_FILTERS: OrderStatus[] = [
  'pending',
  'confirmed',
  'preparing',
  'ready',
  'picked_up',
  'delivered',
  'cancelled',
]

interface OrderFilterBarProps {
  orders: Order[]
  filter: OrderFilter
  onChange: (filter: OrderFilter) => void
}

function countForFilter(orders: Order[], filter: OrderFilter): number {
  if (filter === 'all') return orders.length
  if (filter === 'active') {
    return orders.filter((o) => !['delivered', 'cancelled'].includes(o.status)).length
  }
  return orders.filter((o) => o.status === filter).length
}

export function OrderFilterBar({ orders, filter, onChange }: OrderFilterBarProps) {
  const counts = useMemo(() => {
    const map = new Map<OrderFilter, number>()
    map.set('active', countForFilter(orders, 'active'))
    map.set('all', countForFilter(orders, 'all'))
    for (const s of STATUS_FILTERS) {
      map.set(s, countForFilter(orders, s))
    }
    return map
  }, [orders])

  return (
    <View style={styles.wrap}>
      <View style={styles.primaryRow}>
        {(['active', 'all'] as const).map((key) => (
          <FilterChip
            key={key}
            label={key === 'active' ? 'Active' : 'All orders'}
            count={counts.get(key) ?? 0}
            active={filter === key}
            onPress={() => onChange(key)}
            large
          />
        ))}
      </View>

      <Text style={styles.sectionLabel}>Filter by status</Text>
      <View style={styles.statusGrid}>
        {STATUS_FILTERS.map((status) => (
          <FilterChip
            key={status}
            label={ORDER_STATUS_LABELS[status]}
            count={counts.get(status) ?? 0}
            active={filter === status}
            onPress={() => onChange(status)}
          />
        ))}
      </View>
    </View>
  )
}

function FilterChip({
  label,
  count,
  active,
  onPress,
  large,
}: {
  label: string
  count: number
  active: boolean
  onPress: () => void
  large?: boolean
}) {
  return (
    <TouchableOpacity
      style={[styles.chip, large && styles.chipLarge, active && styles.chipActive]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
    >
      <Text style={[styles.chipLabel, large && styles.chipLabelLarge, active && styles.chipLabelActive]}>
        {label}
      </Text>
      <View style={[styles.badge, active && styles.badgeActive]}>
        <Text style={[styles.badgeText, active && styles.badgeTextActive]}>{count}</Text>
      </View>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.backgroundCard,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  primaryRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  sectionLabel: {
    fontFamily: fonts.sansMedium,
    color: colors.whiteMuted,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: spacing.xs,
  },
  statusGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs + 2,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.backgroundSecondary,
  },
  chipLarge: {
    flex: 1,
    justifyContent: 'center',
    paddingVertical: spacing.sm,
  },
  chipActive: {
    borderColor: colors.gold,
    backgroundColor: 'rgba(212,175,55,0.14)',
  },
  chipLabel: {
    fontFamily: fonts.sansMedium,
    color: colors.whiteMuted,
    fontSize: 12,
  },
  chipLabelLarge: {
    fontSize: 14,
  },
  chipLabelActive: {
    color: colors.gold,
  },
  badge: {
    minWidth: 22,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
    backgroundColor: colors.background,
    alignItems: 'center',
  },
  badgeActive: {
    backgroundColor: colors.gold,
  },
  badgeText: {
    fontFamily: fonts.sansBold,
    color: colors.whiteMuted,
    fontSize: 11,
  },
  badgeTextActive: {
    color: colors.background,
  },
})
