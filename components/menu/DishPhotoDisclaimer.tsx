import React from 'react'
import { Platform, StyleSheet, Text, TextStyle, StyleProp } from 'react-native'
import { DISH_PHOTO_DISCLAIMER } from '../../constants/menu'
import { colors, fonts, spacing } from '../../constants/theme'

type DishPhotoDisclaimerProps = {
  style?: StyleProp<TextStyle>
}

export function DishPhotoDisclaimer({ style }: DishPhotoDisclaimerProps) {
  return (
    <Text style={[styles.disclaimer, Platform.OS === 'web' && styles.disclaimerWeb, style]}>
      {DISH_PHOTO_DISCLAIMER}
    </Text>
  )
}

const styles = StyleSheet.create({
  disclaimer: {
    fontFamily: fonts.displayLight,
    fontStyle: 'italic',
    color: colors.goldLight,
    fontSize: 14,
    lineHeight: 22,
    marginTop: spacing.sm,
    opacity: 0.85,
  },
  disclaimerWeb: {
    fontFamily: '"Dancing Script", cursive',
    fontStyle: 'normal',
    fontSize: 17,
    lineHeight: 24,
  },
})
