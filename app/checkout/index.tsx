import React, { useState } from 'react'
import { View, Text, ScrollView, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useCart } from '../../hooks/useCart'
import { FulfillmentSelector } from '../../components/cart/FulfillmentSelector'
import { PickupScheduler } from '../../components/checkout/PickupScheduler'
import { Input } from '../../components/ui/Input'
import { formatPickupSchedule, isPickupScheduleValid } from '../../lib/services/pickupScheduling'
import { Button } from '../../components/ui/Button'
import { CONTENT_MAX_WIDTH } from '../../constants/checkout'
import { RESTAURANT_ADDRESS } from '../../constants/config'
import { colors, spacing, borderRadius, fonts } from '../../constants/theme'

export default function CheckoutIndex() {
  const router = useRouter()
  const cart = useCart()
  const [street, setStreet] = useState('123 Main St')
  const [city, setCity] = useState('Northville')
  const [zip, setZip] = useState('48167')

  if (cart.items.length === 0) {
    router.replace('/(tabs)/cart' as never)
    return null
  }

  const isDelivery = cart.fulfillmentType === 'delivery'
  const canPlace = isDelivery
    ? Boolean(street.trim() && city.trim() && zip.trim())
    : isPickupScheduleValid(cart.pickupDate, cart.pickupTime)

  const handlePlaceOrder = () => {
    router.push({
      pathname: '/checkout/success',
      params: {
        fulfillment: cart.fulfillmentType,
        eta: String(cart.deliveryEtaMinutes),
        address: isDelivery ? `${street}, ${city}, MI ${zip}` : RESTAURANT_ADDRESS,
        pickupSchedule: isDelivery
          ? ''
          : formatPickupSchedule(cart.pickupDate, cart.pickupTime),
        pickupDate: cart.pickupDate,
        pickupTime: cart.pickupTime,
        total: String(cart.total),
      },
    } as never)
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.inner}>
        <Text style={styles.heading}>Checkout</Text>
        <Text style={styles.subheading}>Review your order and place it — demo mode</Text>

        <View style={styles.mockBanner}>
          <Ionicons name="information-circle-outline" size={18} color={colors.gold} />
          <Text style={styles.mockText}>
            Mock checkout — no payment required. Stripe and live DoorDash dispatch connect at launch.
          </Text>
        </View>

        <FulfillmentSelector
          value={cart.fulfillmentType}
          onChange={cart.setFulfillmentType}
        />

        {isDelivery ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Delivery Address</Text>
            <Input
              label="Street"
              value={street}
              onChangeText={setStreet}
              placeholder="123 Main St"
            />
            <Input label="City" value={city} onChangeText={setCity} placeholder="Northville" />
            <Input
              label="ZIP"
              value={zip}
              onChangeText={setZip}
              keyboardType="number-pad"
              placeholder="48167"
            />
            <View style={styles.quoteCard}>
              <View style={styles.quoteRow}>
                <Ionicons name="bicycle" size={18} color="#FF3008" />
                <Text style={styles.quoteLabel}>DoorDash Drive quote</Text>
              </View>
              <Text style={styles.quoteValue}>
                ${(cart.deliveryFee / 100).toFixed(2)} · ~{cart.deliveryEtaMinutes} min
              </Text>
            </View>
          </View>
        ) : (
          <PickupScheduler
            date={cart.pickupDate}
            time={cart.pickupTime}
            onDateChange={cart.setPickupDate}
            onTimeChange={cart.setPickupTime}
          />
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Order Summary</Text>
          <View style={styles.summaryCard}>
            {cart.items.map((item) => (
              <View key={item.menuItemId} style={styles.itemRow}>
                <Text style={styles.itemQty}>{item.quantity}×</Text>
                <Text style={styles.itemName} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={styles.itemPrice}>
                  ${((item.price * item.quantity) / 100).toFixed(2)}
                </Text>
              </View>
            ))}
            <View style={styles.divider} />
            <SummaryLine label="Subtotal" value={cart.subtotal()} />
            <SummaryLine label="Tax" value={cart.tax} />
            <SummaryLine label="Service Fee" value={cart.serviceFee} />
            {isDelivery && <SummaryLine label="DoorDash Delivery" value={cart.deliveryFee} />}
            <View style={styles.divider} />
            <SummaryLine label="Total" value={cart.total} bold />
          </View>
        </View>

        <Button
          label={`Place Order · $${(cart.total / 100).toFixed(2)}`}
          onPress={handlePlaceOrder}
          fullWidth
          size="lg"
          disabled={!canPlace}
          style={{ marginTop: spacing.sm }}
        />
      </View>
    </ScrollView>
  )
}

function SummaryLine({ label, value, bold }: { label: string; value: number; bold?: boolean }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={[styles.label, bold && styles.bold]}>{label}</Text>
      <Text style={[styles.value, bold && styles.bold]}>${(value / 100).toFixed(2)}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
    alignItems: 'center',
  },
  inner: {
    width: '100%',
    maxWidth: CONTENT_MAX_WIDTH,
    gap: spacing.md,
  },
  heading: {
    fontFamily: fonts.serif,
    color: colors.gold,
    fontSize: 26,
  },
  subheading: {
    fontFamily: fonts.sans,
    color: colors.whiteMuted,
    fontSize: 14,
    marginBottom: spacing.xs,
  },
  mockBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: 'rgba(212,175,55,0.08)',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
  },
  mockText: {
    flex: 1,
    fontFamily: fonts.sans,
    color: colors.whiteMuted,
    fontSize: 12,
    lineHeight: 18,
  },
  section: { gap: spacing.sm },
  sectionTitle: {
    fontFamily: fonts.sansBold,
    color: colors.white,
    fontSize: 14,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  quoteCard: {
    backgroundColor: colors.backgroundCard,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: 4,
  },
  quoteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  quoteLabel: {
    fontFamily: fonts.sansMedium,
    color: colors.whiteMuted,
    fontSize: 12,
  },
  quoteValue: {
    fontFamily: fonts.sansBold,
    color: colors.gold,
    fontSize: 18,
  },
  summaryCard: {
    backgroundColor: colors.backgroundCard,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: 8,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  itemQty: {
    fontFamily: fonts.sansBold,
    color: colors.gold,
    width: 28,
    fontSize: 14,
  },
  itemName: {
    flex: 1,
    fontFamily: fonts.sans,
    color: colors.white,
    fontSize: 14,
  },
  itemPrice: {
    fontFamily: fonts.sansMedium,
    color: colors.whiteMuted,
    fontSize: 14,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 4,
  },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between' },
  label: {
    fontFamily: fonts.sans,
    color: colors.whiteMuted,
    fontSize: 14,
  },
  value: {
    fontFamily: fonts.sans,
    color: colors.white,
    fontSize: 14,
  },
  bold: {
    fontFamily: fonts.sansBold,
    color: colors.white,
    fontSize: 16,
  },
})
