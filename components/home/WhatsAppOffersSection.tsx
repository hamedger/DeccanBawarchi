import React from 'react'
import { View, Text, Image, StyleSheet, useWindowDimensions } from 'react-native'
import { colors, spacing, borderRadius, fonts } from '../../constants/theme'

const QR_IMAGE = require('../../assets/promo/whatsapp-offers-qr.png')
const WIDE_BREAKPOINT = 720

export function WhatsAppOffersSection() {
  const { width } = useWindowDimensions()
  const isWide = width >= WIDE_BREAKPOINT
  const qrSize = isWide ? 200 : 180

  return (
    <View style={styles.section}>
      <View style={[styles.card, isWide && styles.cardWide]}>
        <View style={[styles.copy, isWide && styles.copyWide]}>
          <Text style={styles.eyebrow}>WHATSAPP GROUP</Text>
          <Text style={[styles.title, isWide && styles.textLeft]}>Deccan Bawarchi Exclusive Offers</Text>
          <Text style={[styles.description, isWide && styles.textLeft]}>
            Be the first to hear about specials, new dishes, and members-only deals. Scan the QR
            code with your phone's camera or WhatsApp to join.
          </Text>
        </View>
        <View style={styles.qrFrame}>
          <Image
            source={QR_IMAGE}
            style={{ width: qrSize, height: qrSize }}
            resizeMode="contain"
            accessibilityLabel="QR code to join the Deccan Bawarchi Exclusive Offers WhatsApp group"
          />
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  section: {
    marginHorizontal: spacing.md,
    marginTop: spacing.xl,
  },
  card: {
    backgroundColor: colors.backgroundCard,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: borderRadius.sm,
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.lg,
  },
  cardWide: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  copy: {
    alignItems: 'center',
  },
  copyWide: {
    flex: 1,
    alignItems: 'flex-start',
  },
  eyebrow: {
    fontFamily: fonts.sansMedium,
    color: colors.greenLight,
    fontSize: 12,
    letterSpacing: 2,
    marginBottom: spacing.xs,
  },
  title: {
    fontFamily: fonts.serif,
    color: colors.white,
    fontSize: 22,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  description: {
    fontFamily: fonts.sans,
    color: colors.whiteMuted,
    fontSize: 14,
    lineHeight: 21,
    maxWidth: 460,
    textAlign: 'center',
  },
  textLeft: { textAlign: 'left' },
  qrFrame: {
    backgroundColor: '#ffffff',
    padding: spacing.sm,
    borderRadius: 8,
  },
})
