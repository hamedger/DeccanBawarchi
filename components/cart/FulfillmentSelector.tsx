import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { FulfillmentType } from '../../types/order'
import { DELIVERY_RADIUS_MILES, RESTAURANT_ADDRESS } from '../../constants/config'
import {
  MOCK_DELIVERY_FEE_CENTS,
  MOCK_DELIVERY_ETA_MINUTES,
  MOCK_PICKUP_ETA_MINUTES,
} from '../../constants/checkout'
import { colors, spacing, borderRadius, fonts } from '../../constants/theme'

interface FulfillmentSelectorProps {
  value: FulfillmentType
  onChange: (type: FulfillmentType) => void
}

function formatFee(cents: number) {
  return cents === 0 ? 'Free' : `$${(cents / 100).toFixed(2)}`
}

export function FulfillmentSelector({ value, onChange }: FulfillmentSelectorProps) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>How would you like your order?</Text>

      <TouchableOpacity
        style={[styles.card, value === 'delivery' && styles.cardActive]}
        onPress={() => onChange('delivery')}
        activeOpacity={0.8}
      >
        <View style={styles.cardHeader}>
          <View style={[styles.iconWrap, styles.deliveryIcon]}>
            <Ionicons name="bicycle" size={20} color="#FF3008" />
          </View>
          <View style={styles.cardTitles}>
            <Text style={styles.cardTitle}>DoorDash Delivery</Text>
            <Text style={styles.cardBadge}>Powered by DoorDash Drive</Text>
          </View>
          {value === 'delivery' ? (
            <Ionicons name="checkmark-circle" size={22} color={colors.gold} />
          ) : (
            <View style={styles.radio} />
          )}
        </View>
        <Text style={styles.cardMeta}>
          {formatFee(MOCK_DELIVERY_FEE_CENTS)} delivery fee · Est. {MOCK_DELIVERY_ETA_MINUTES} min
        </Text>
        <Text style={styles.cardHint}>Delivered hot to your door within {DELIVERY_RADIUS_MILES} miles</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.card, value === 'pickup' && styles.cardActive]}
        onPress={() => onChange('pickup')}
        activeOpacity={0.8}
      >
        <View style={styles.cardHeader}>
          <View style={[styles.iconWrap, styles.pickupIcon]}>
            <Ionicons name="bag-handle" size={20} color={colors.gold} />
          </View>
          <View style={styles.cardTitles}>
            <Text style={styles.cardTitle}>Restaurant Pickup</Text>
            <Text style={styles.cardBadge}>No delivery fees</Text>
          </View>
          {value === 'pickup' ? (
            <Ionicons name="checkmark-circle" size={22} color={colors.gold} />
          ) : (
            <View style={styles.radio} />
          )}
        </View>
        <Text style={styles.cardMeta}>Schedule date and time at checkout</Text>
        <Text style={styles.cardHint} numberOfLines={2}>{RESTAURANT_ADDRESS}</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  label: {
    fontFamily: fonts.sansBold,
    color: colors.white,
    fontSize: 14,
    marginBottom: spacing.xs,
  },
  card: {
    backgroundColor: colors.backgroundCard,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: 6,
  },
  cardActive: {
    borderColor: colors.gold,
    backgroundColor: 'rgba(212,175,55,0.06)',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deliveryIcon: { backgroundColor: 'rgba(255,48,8,0.12)' },
  pickupIcon: { backgroundColor: 'rgba(212,175,55,0.12)' },
  cardTitles: { flex: 1 },
  cardTitle: {
    fontFamily: fonts.sansBold,
    color: colors.white,
    fontSize: 15,
  },
  cardBadge: {
    fontFamily: fonts.sans,
    color: colors.whiteMuted,
    fontSize: 11,
    marginTop: 2,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.borderStrong,
  },
  cardMeta: {
    fontFamily: fonts.sansMedium,
    color: colors.gold,
    fontSize: 13,
    marginLeft: 48,
  },
  cardHint: {
    fontFamily: fonts.sans,
    color: colors.whiteMuted,
    fontSize: 12,
    lineHeight: 17,
    marginLeft: 48,
  },
})
