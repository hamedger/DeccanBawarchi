import React from 'react'
import {
  View,
  Text,
  StyleSheet,
  Switch,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native'
import { MenuItem } from '../../types/menu'
import { AdminBuffetRow } from '../../lib/buffetLayout'
import { isBuffetDishServing } from '../../lib/services/buffetService'
import { colors, spacing, fonts } from '../../constants/theme'

const BUFFET_ON = colors.green
const BUFFET_OFF = colors.error

interface AdminBuffetItemRowProps {
  row: AdminBuffetRow
  buffetBusy: boolean
  servingBusy: boolean
  onToggleBuffet: (item: MenuItem) => void
  onToggleServing: (menuItemId: string, next: boolean) => void
}

export function AdminBuffetItemRow({
  row,
  buffetBusy,
  servingBusy,
  onToggleBuffet,
  onToggleServing,
}: AdminBuffetItemRowProps) {
  const { menuItem, buffetDish, displayName } = row
  const onBuffet = !!buffetDish
  const isServing = buffetDish ? isBuffetDishServing(buffetDish) : false
  const disabled = !menuItem

  return (
    <View
      style={[
        styles.itemRow,
        onBuffet && styles.itemRowOn,
        onBuffet && !isServing && styles.itemRowPaused,
        disabled && styles.itemRowMissing,
      ]}
    >
      {disabled ? (
        <View style={[styles.statusBtn, styles.statusDot, styles.statusMissing]} />
      ) : buffetBusy ? (
        <ActivityIndicator size="small" color={colors.gold} style={styles.statusBtn} />
      ) : (
        <TouchableOpacity
          onPress={() => menuItem && onToggleBuffet(menuItem)}
          style={[
            styles.statusBtn,
            styles.statusDot,
            { backgroundColor: onBuffet ? BUFFET_ON : BUFFET_OFF },
          ]}
          accessibilityRole="button"
          accessibilityLabel={
            onBuffet
              ? `${displayName}, on buffet. Tap to remove.`
              : `${displayName}, not on buffet. Tap to add.`
          }
        />
      )}

      <View style={styles.itemBody}>
        <Text
          style={[styles.itemName, !onBuffet && styles.itemNameOff, disabled && styles.itemNameMissing]}
          numberOfLines={2}
        >
          {displayName}
        </Text>
        <Text style={styles.itemMeta}>
          {disabled
            ? 'Not in menu catalog yet'
            : menuItem.category.replace(/-/g, ' ')}
          {onBuffet ? (isServing ? ' · serving now' : ' · paused') : ''}
        </Text>
      </View>

      {onBuffet && menuItem ? (
        servingBusy ? (
          <ActivityIndicator size="small" color={colors.gold} />
        ) : (
          <View style={styles.servingCol}>
            <Text style={[styles.servingLabel, !isServing && styles.servingLabelOff]}>
              {isServing ? 'Serving' : 'Paused'}
            </Text>
            <Switch
              value={isServing}
              onValueChange={(v) => onToggleServing(menuItem.id, v)}
              thumbColor={isServing ? colors.gold : colors.whiteMuted}
              trackColor={{ true: colors.goldDark, false: colors.border }}
            />
          </View>
        )
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.sm,
  },
  itemRowOn: {
    backgroundColor: 'rgba(67, 160, 71, 0.06)',
  },
  itemRowPaused: {
    backgroundColor: 'rgba(239, 83, 80, 0.05)',
  },
  itemRowMissing: {
    opacity: 0.55,
  },
  statusBtn: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusDot: {
    borderRadius: 14,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  statusMissing: {
    backgroundColor: colors.border,
  },
  itemBody: { flex: 1, minWidth: 0 },
  itemName: {
    fontFamily: fonts.sansMedium,
    color: colors.white,
    fontSize: 14,
  },
  itemNameOff: {
    color: colors.whiteMuted,
  },
  itemNameMissing: {
    color: colors.whiteMuted,
  },
  itemMeta: {
    fontFamily: fonts.sans,
    color: colors.whiteMuted,
    fontSize: 11,
    marginTop: 2,
    textTransform: 'capitalize',
  },
  servingCol: {
    alignItems: 'center',
    width: 72,
    gap: 2,
  },
  servingLabel: {
    fontFamily: fonts.sans,
    color: colors.greenLight,
    fontSize: 9,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  servingLabelOff: {
    color: colors.error,
  },
})
