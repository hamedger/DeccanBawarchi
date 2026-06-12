import React from 'react'
import { ScrollView, View, StyleSheet } from 'react-native'
import { HalalBadge } from '../brand/HalalBadge'
import { HeroSection } from './HeroSection'
import { BuffetBanner } from './BuffetBanner'
import { StatsStrip } from './StatsStrip'
import { FeaturedDishes } from './FeaturedDishes'
import { ConversionSection } from './ConversionSection'
import { OrynPromoBlock } from './OrynPromoBlock'
import { DemoBanner } from '../shared/DemoBanner'
import { colors, spacing } from '../../constants/theme'

export function HomeScreen() {
  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <DemoBanner />

      <View style={styles.announcementBar}>
        <HalalBadge size="xl" showPercent />
      </View>

      <HeroSection />
      <BuffetBanner />
      <StatsStrip />
      <FeaturedDishes />
      <OrynPromoBlock />
      <ConversionSection />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  announcementBar: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
})
