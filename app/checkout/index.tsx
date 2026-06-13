import React, { useCallback, useEffect, useRef, useState } from 'react'
import { View, Text, ScrollView, StyleSheet } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useCart } from '../../hooks/useCart'
import { useAuth } from '../../hooks/useAuth'
import { FulfillmentSelector } from '../../components/cart/FulfillmentSelector'
import { PickupScheduler } from '../../components/checkout/PickupScheduler'
import { Input } from '../../components/ui/Input'
import { formatPickupSchedule, isPickupScheduleValid } from '../../lib/services/pickupScheduling'
import { loyaltyDiscountCents } from '../../lib/services/loyaltyService'
import {
  redirectToCloverCheckout,
  saveCheckoutContext,
  startCloverCheckout,
} from '../../lib/services/cloverCheckout'
import { Button } from '../../components/ui/Button'
import { CONTENT_MAX_WIDTH } from '../../constants/checkout'
import { DELIVERY_ENABLED } from '../../constants/config'
import { isApiConfigured } from '../../constants/api'
import { colors, spacing, borderRadius, fonts } from '../../constants/theme'
import { useSelectedLocation } from '../../hooks/useSelectedLocation'
import { LocationConfirmCard } from '../../components/location/LocationConfirmCard'
import { formatLocationAddress } from '../../lib/locationUtils'
import { confirmOrderLocation } from '../../lib/confirmOrderLocation'
import { User as FirebaseUser } from 'firebase/auth'
import { User } from '../../types/user'
import { TAX_LABEL } from '../../lib/services/cartService'
import { CHECKOUT_RETURN_PATH } from '../../lib/authReturnTo'

function hasCheckoutAuth(firebaseUser: FirebaseUser | null, userProfile: User | null) {
  const email = userProfile?.email?.trim() || firebaseUser?.email?.trim()
  return Boolean(firebaseUser && email)
}

function redirectToCheckoutLogin(router: ReturnType<typeof useRouter>) {
  router.replace({
    pathname: '/(auth)/login',
    params: { returnTo: CHECKOUT_RETURN_PATH },
  } as never)
}

export default function CheckoutIndex() {
  const router = useRouter()
  const { pay } = useLocalSearchParams<{ pay?: string }>()
  const cart = useCart()
  const { firebaseUser, userProfile, isLoading: authLoading } = useAuth()
  const { location, locationId, locations, loading: locationsLoading, hasSelection } =
    useSelectedLocation()
  const [street, setStreet] = useState('123 Main St')
  const [city, setCity] = useState('Northville')
  const [zip, setZip] = useState('48167')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const autoPayStarted = useRef(false)

  const isDelivery = DELIVERY_ENABLED && cart.fulfillmentType === 'delivery'
  const isAuthed = hasCheckoutAuth(firebaseUser, userProfile)
  const canPlace =
    hasSelection &&
    (isDelivery
      ? Boolean(street.trim() && city.trim() && zip.trim())
      : isPickupScheduleValid(cart.pickupDate, cart.pickupTime))
  const canContinue = isAuthed ? canPlace : true

  const processPayment = useCallback(
    async (options?: { skipLocationConfirm?: boolean }) => {
      setError(null)

      if (!isAuthed) {
        redirectToCheckoutLogin(router)
        return
      }

      if (!hasSelection || !location) {
        setError('Please choose which restaurant you are ordering from.')
        return
      }

      if (!isApiConfigured()) {
        setError('The payment server is not configured for this build. Contact support.')
        return
      }

      if (!options?.skipLocationConfirm) {
        const confirmed = await confirmOrderLocation(location)
        if (!confirmed) return
      }

      setLoading(true)
      const fulfillment = cart.fulfillmentType
      const pickupAddress = formatLocationAddress(location.address)
      const address = isDelivery ? `${street}, ${city}, MI ${zip}` : pickupAddress
      const pickupSchedule = isDelivery
        ? ''
        : formatPickupSchedule(cart.pickupDate, cart.pickupTime)

      try {
        const customerEmail = userProfile?.email?.trim() || firebaseUser?.email?.trim() || ''
        const { href } = await startCloverCheckout({
          items: cart.items,
          subtotal: cart.subtotal(),
          tax: cart.tax,
          serviceFee: cart.serviceFee,
          deliveryFee: cart.deliveryFee,
          tip: cart.tip,
          total: cart.total,
          promoCode: cart.promoCode,
          promoDiscount: cart.promoDiscount,
          loyaltyPointsToRedeem: cart.loyaltyPointsToRedeem,
          giftCardAmount: cart.giftCardAmount,
          fulfillmentType: fulfillment,
          deliveryAddress: isDelivery
            ? {
                id: '',
                label: 'Delivery',
                street: street.trim(),
                city: city.trim(),
                state: 'MI',
                zip: zip.trim(),
                country: 'US',
              }
            : null,
          notes: cart.notes,
          locationId,
          customerName: userProfile?.displayName ?? firebaseUser?.displayName ?? '',
          customerPhone: userProfile?.phone ?? '',
          customerEmail,
          pickupDate: isDelivery ? undefined : cart.pickupDate,
          pickupTime: isDelivery ? undefined : cart.pickupTime,
        })

        saveCheckoutContext({
          fulfillment,
          address,
          pickupSchedule,
          total: String(cart.total),
        })

        redirectToCloverCheckout(href)
      } catch (e) {
        const message =
          e instanceof Error ? e.message : 'Could not start payment. Please try again.'
        setError(message)
      } finally {
        setLoading(false)
      }
    },
    [
      cart,
      firebaseUser,
      userProfile,
      isAuthed,
      hasSelection,
      location,
      locationId,
      isDelivery,
      street,
      city,
      zip,
      router,
    ],
  )

  useEffect(() => {
    if (pay !== '1' || autoPayStarted.current || authLoading || locationsLoading) return
    if (!isAuthed || !canPlace || !location) return

    autoPayStarted.current = true
    void processPayment({ skipLocationConfirm: true })
  }, [
    pay,
    authLoading,
    locationsLoading,
    isAuthed,
    canPlace,
    location,
    processPayment,
  ])

  const handlePlaceOrder = () => {
    void processPayment()
  }

  useEffect(() => {
    if (cart.items.length === 0) {
      router.replace('/(tabs)/cart' as never)
    }
  }, [cart.items.length, router])

  if (cart.items.length === 0) {
    return null
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.inner}>
        <Text style={styles.heading}>Checkout</Text>
        <Text style={styles.subheading}>Review your order, then pay securely with Clover</Text>

        {error ? (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle-outline" size={18} color={colors.error} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {location ? (
          <LocationConfirmCard
            location={location}
            locations={locations}
            selectedLocationId={locationId}
            loading={locationsLoading}
          />
        ) : null}

        <FulfillmentSelector
          value={cart.fulfillmentType}
          onChange={cart.setFulfillmentType}
          pickupAddress={location ? formatLocationAddress(location.address) : undefined}
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
            pickupAddress={location ? formatLocationAddress(location.address) : ''}
            locationName={location?.name}
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
            <SummaryLine label={TAX_LABEL} value={cart.tax} />
            <SummaryLine label="Service Fee" value={cart.serviceFee} />
            {isDelivery && <SummaryLine label="DoorDash Delivery" value={cart.deliveryFee} />}
            {cart.loyaltyPointsToRedeem > 0 && (
              <SummaryLine
                label="Loyalty Discount"
                value={-loyaltyDiscountCents(cart.loyaltyPointsToRedeem)}
              />
            )}
            <View style={styles.divider} />
            <SummaryLine label="Total" value={cart.total} bold />
          </View>
        </View>

        <Button
          label={loading ? 'Starting payment…' : `Continue to Payment · $${(cart.total / 100).toFixed(2)}`}
          onPress={handlePlaceOrder}
          loading={loading}
          fullWidth
          size="lg"
          disabled={!canContinue}
          style={{ marginTop: spacing.sm }}
        />

        {!canContinue && isAuthed ? (
          <Text style={styles.helperText}>
            {!hasSelection
              ? 'Select a restaurant location to continue.'
              : 'Choose a pickup date and time to continue.'}
          </Text>
        ) : null}
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
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: 'rgba(239,68,68,0.08)',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.error,
    padding: spacing.sm,
  },
  errorText: {
    flex: 1,
    fontFamily: fonts.sans,
    color: colors.error,
    fontSize: 12,
    lineHeight: 18,
  },
  helperText: {
    fontFamily: fonts.sans,
    color: colors.whiteMuted,
    fontSize: 12,
    textAlign: 'center',
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
