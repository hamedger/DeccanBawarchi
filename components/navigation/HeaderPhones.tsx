import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet, useWindowDimensions } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import {
  formatLocationShort,
  formatPhoneDisplay,
  openPhone,
} from '../../lib/locationUtils'
import { useLocations } from '../../hooks/useLocations'
import { colors, spacing, fonts } from '../../constants/theme'

export function HeaderPhones() {
  const { width } = useWindowDimensions()
  const compact = width < 480
  const { locations } = useLocations()

  return (
    <View style={styles.wrap}>
      {locations.map((location) => {
        const label = formatLocationShort(location)
        const phone = formatPhoneDisplay(location.phone)
        return (
          <TouchableOpacity
            key={location.id}
            style={styles.row}
            onPress={() => openPhone(location.phone)}
            accessibilityRole="link"
            accessibilityLabel={`Call ${label} at ${phone}`}
            hitSlop={4}
          >
            <Ionicons name="call-outline" size={compact ? 11 : 12} color={colors.gold} />
            {!compact && <Text style={styles.label}>{label}</Text>}
            <Text style={[styles.phone, compact && styles.phoneCompact]}>{phone}</Text>
          </TouchableOpacity>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'flex-end',
    gap: 2,
    paddingRight: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  label: {
    fontFamily: fonts.sansMedium,
    color: colors.whiteMuted,
    fontSize: 10,
  },
  phone: {
    fontFamily: fonts.sansBold,
    color: colors.goldLight,
    fontSize: 14,
  },
  phoneCompact: {
    fontSize: 13,
  },
})
