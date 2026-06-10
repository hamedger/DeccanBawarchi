import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { colors } from '../../constants/theme'

interface HalalBadgeProps {
  size?: 'sm' | 'md' | 'lg'
}

export function HalalBadge({ size = 'md' }: HalalBadgeProps) {
  const padding = size === 'sm' ? { horizontal: 8, vertical: 3 } : size === 'lg' ? { horizontal: 16, vertical: 8 } : { horizontal: 12, vertical: 5 }
  const fontSize = size === 'sm' ? 9 : size === 'lg' ? 14 : 11

  return (
    <View style={[styles.badge, { paddingHorizontal: padding.horizontal, paddingVertical: padding.vertical }]}>
      <Text style={[styles.text, { fontSize }]}>☽ ZABIHA HALAL</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.green,
    backgroundColor: 'rgba(67, 160, 71, 0.12)',
  },
  text: {
    color: colors.greenLight,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
})
