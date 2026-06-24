import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { FulfillmentType } from '../../types/order'
import { TIP_PERCENT_OPTIONS } from '../../constants/checkout'
import { calculateTipFromPercent } from '../../lib/services/cartService'
import { colors, spacing, borderRadius, fonts } from '../../constants/theme'

interface TipSelectorProps {
  subtotal: number
  tipPercent: number | null
  tip: number
  fulfillmentType: FulfillmentType
  onSelectPercent: (percent: number | null) => void
}

export function TipSelector({
  subtotal,
  tipPercent,
  tip,
  fulfillmentType,
  onSelectPercent,
}: TipSelectorProps) {
  const hint =
    fulfillmentType === 'delivery'
      ? 'Optional tip for your delivery driver'
      : 'Optional tip for the restaurant team'

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Text style={styles.title}>Add a Tip</Text>
        <Text style={styles.hint}>{hint}</Text>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.chip, tipPercent === null && tip === 0 && styles.chipActive]}
          onPress={() => onSelectPercent(null)}
        >
          <Text
            style={[
              styles.chipText,
              tipPercent === null && tip === 0 && styles.chipTextActive,
            ]}
          >
            No tip
          </Text>
        </TouchableOpacity>

        {TIP_PERCENT_OPTIONS.map((percent) => {
          const amount = calculateTipFromPercent(subtotal, percent)
          const selected = tipPercent === percent

          return (
            <TouchableOpacity
              key={percent}
              style={[styles.chip, selected && styles.chipActive]}
              onPress={() => onSelectPercent(percent)}
            >
              <Text style={[styles.chipText, selected && styles.chipTextActive]}>
                {percent}%
              </Text>
              <Text style={[styles.chipAmount, selected && styles.chipTextActive]}>
                ${(amount / 100).toFixed(2)}
              </Text>
            </TouchableOpacity>
          )
        })}
      </View>

      {tip > 0 && (
        <Text style={styles.applied}>
          Tip: ${(tip / 100).toFixed(2)}
          {tipPercent != null ? ` (${tipPercent}%)` : ''}
        </Text>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  header: {
    gap: 2,
  },
  title: {
    fontFamily: fonts.sansMedium,
    color: colors.white,
    fontSize: 13,
  },
  hint: {
    fontFamily: fonts.sans,
    color: colors.whiteMuted,
    fontSize: 12,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    minWidth: 72,
    alignItems: 'center',
  },
  chipActive: {
    borderColor: colors.gold,
    backgroundColor: 'rgba(212,175,55,0.12)',
  },
  chipText: {
    fontFamily: fonts.sansMedium,
    color: colors.whiteMuted,
    fontSize: 12,
  },
  chipTextActive: {
    color: colors.gold,
  },
  chipAmount: {
    fontFamily: fonts.sans,
    color: colors.whiteMuted,
    fontSize: 10,
    marginTop: 1,
  },
  applied: {
    fontFamily: fonts.sans,
    color: colors.greenLight,
    fontSize: 12,
  },
})
