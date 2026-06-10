import React, { useState } from 'react'
import { View, Text, ScrollView, StyleSheet, ActivityIndicator } from 'react-native'
import { useRouter } from 'expo-router'
import { Input } from '../../components/ui/Input'
import { Button } from '../../components/ui/Button'
import { useDeliveryQuote } from '../../hooks/useDeliveryQuote'
import { useCart } from '../../hooks/useCart'
import { colors, spacing } from '../../constants/theme'

export default function DeliveryScreen() {
  const router = useRouter()
  const [street, setStreet] = useState('')
  const [city, setCity] = useState('')
  const [zip, setZip] = useState('')
  const { quote, loading, error, fetchQuote } = useDeliveryQuote()
  const cart = useCart()

  const handleGetQuote = () => {
    if (!street || !city || !zip) return
    fetchQuote(`${street}, ${city}, MI ${zip}`, cart.subtotal())
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Delivery Address</Text>
      <Input label="Street Address" value={street} onChangeText={setStreet} placeholder="123 Main St" />
      <Input label="City" value={city} onChangeText={setCity} placeholder="Northville" />
      <Input label="ZIP Code" value={zip} onChangeText={setZip} keyboardType="number-pad" placeholder="48167" />

      {error && <Text style={styles.error}>{error}</Text>}

      {quote ? (
        <View style={styles.quoteCard}>
          <Text style={styles.quoteLabel}>Delivery Fee</Text>
          <Text style={styles.quoteValue}>${(quote.fee / 100).toFixed(2)}</Text>
          <Text style={styles.quoteEta}>Estimated: {quote.etaMinutes} mins</Text>
        </View>
      ) : (
        <Button label="Get Delivery Quote" onPress={handleGetQuote} loading={loading} fullWidth />
      )}

      {quote && (
        <Button
          label="Continue to Payment"
          onPress={() => router.push('/checkout/payment' as any)}
          fullWidth
          size="lg"
          style={{ marginTop: spacing.md }}
        />
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg },
  title: { color: colors.white, fontSize: 22, fontWeight: '800', marginBottom: spacing.lg },
  error: { color: colors.error, fontSize: 13, marginBottom: spacing.md },
  quoteCard: {
    backgroundColor: colors.backgroundCard,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    padding: spacing.lg,
    alignItems: 'center',
    marginVertical: spacing.md,
  },
  quoteLabel: { color: colors.whiteMuted, fontSize: 12, fontWeight: '700', letterSpacing: 1 },
  quoteValue: { color: colors.gold, fontSize: 32, fontWeight: '800', marginTop: 4 },
  quoteEta: { color: colors.whiteMuted, fontSize: 13, marginTop: 4 },
})
