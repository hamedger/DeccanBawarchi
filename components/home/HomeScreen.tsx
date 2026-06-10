import React from 'react'
import { ScrollView, View, Text, StyleSheet } from 'react-native'
import { HalalBadge } from '../brand/HalalBadge'
import { HeroSection } from './HeroSection'
import { BuffetBanner } from './BuffetBanner'
import { StatsStrip } from './StatsStrip'
import { FeaturedDishes } from './FeaturedDishes'
import { ConversionSection } from './ConversionSection'
import { DemoBanner } from '../shared/DemoBanner'
import { colors, spacing, borderRadius, fonts } from '../../constants/theme'
import { RESTAURANT_ADDRESS, RESTAURANT_PHONE } from '../../constants/config'
import { formatBusinessHours } from '../../constants/home'

export function HomeScreen() {
  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <DemoBanner />

      <View style={styles.announcementBar}>
        <HalalBadge size="sm" />
        <Text style={styles.announcementText}>100% Zabiha Halal · Northville, Michigan</Text>
      </View>

      <HeroSection />
      <BuffetBanner />
      <StatsStrip />
      <FeaturedDishes />
      <ConversionSection />

      <View style={styles.infoStrip}>
        <Text style={styles.infoTitle}>Visit Us</Text>
        <View style={styles.infoDivider} />
        <Text style={styles.infoText}>{RESTAURANT_ADDRESS}</Text>
        <Text style={styles.infoText}>{RESTAURANT_PHONE}</Text>
        <Text style={styles.infoHours}>{formatBusinessHours()}</Text>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  announcementBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  announcementText: {
    fontFamily: fonts.sans,
    color: colors.whiteMuted,
    fontSize: 12,
  },
  infoStrip: {
    margin: spacing.lg,
    padding: spacing.lg,
    backgroundColor: colors.background,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.xxl,
  },
  infoTitle: {
    fontFamily: fonts.serif,
    color: colors.gold,
    fontSize: 16,
    marginBottom: spacing.sm,
  },
  infoDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginBottom: spacing.md,
  },
  infoText: {
    fontFamily: fonts.sans,
    color: colors.whiteMuted,
    fontSize: 13,
    marginBottom: spacing.xs,
  },
  infoHours: {
    fontFamily: fonts.sansMedium,
    color: colors.white,
    fontSize: 13,
    marginTop: spacing.xs,
  },
})
