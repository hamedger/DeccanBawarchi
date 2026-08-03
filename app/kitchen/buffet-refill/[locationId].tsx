import React, { useEffect, useState } from 'react'
import { View, Text, StyleSheet, ScrollView } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '../../../lib/firebase'
import { AdminGate } from '../../../components/admin/AdminGate'
import { isBuffetDishNeedsRefill } from '../../../lib/services/buffetService'
import { BuffetConfig, BuffetDish } from '../../../types/buffet'
import { colors, spacing, borderRadius, fonts } from '../../../constants/theme'

function DishCard({ dish }: { dish: BuffetDish }) {
  return (
    <View style={styles.card}>
      <View style={[styles.dot, { backgroundColor: dish.isVegetarian ? colors.greenLight : colors.error }]} />
      <Text style={styles.cardName}>{dish.name}</Text>
    </View>
  )
}

function RefillBoard({ locationId }: { locationId: string }) {
  const [config, setConfig] = useState<BuffetConfig | null>(null)
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'buffet', locationId), (snap) => {
      setConfig(snap.exists() ? (snap.data() as BuffetConfig) : null)
    })
    return unsub
  }, [locationId])

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(interval)
  }, [])

  const needsRefill = (config?.todaysDishes ?? []).filter(isBuffetDishNeedsRefill)

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Buffet Refill Board</Text>
        <Text style={styles.headerClock}>
          {now.toLocaleTimeString('en-US', {
            timeZone: 'America/Detroit',
            hour: 'numeric',
            minute: '2-digit',
          })}
        </Text>
      </View>

      {needsRefill.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyTitle}>All Stocked</Text>
          <Text style={styles.emptySubtitle}>No dishes currently need a refill</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.grid}>
          {needsRefill.map((dish) => (
            <DishCard key={dish.menuItemId} dish={dish} />
          ))}
        </ScrollView>
      )}
    </View>
  )
}

export default function BuffetRefillDisplayScreen() {
  const { locationId } = useLocalSearchParams<{ locationId: string }>()

  return (
    <AdminGate>
      <RefillBoard locationId={locationId ?? 'farmington-hills-mi'} />
    </AdminGate>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  headerTitle: {
    fontFamily: fonts.serif,
    color: colors.white,
    fontSize: 28,
  },
  headerClock: {
    fontFamily: fonts.display,
    color: colors.gold,
    fontSize: 28,
  },
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontFamily: fonts.serif,
    color: colors.greenLight,
    fontSize: 48,
    marginBottom: spacing.md,
  },
  emptySubtitle: {
    fontFamily: fonts.sans,
    color: colors.whiteMuted,
    fontSize: 18,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: spacing.xl,
    gap: spacing.lg,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minWidth: 280,
    backgroundColor: colors.backgroundCard,
    borderRadius: borderRadius.lg,
    borderWidth: 2,
    borderColor: colors.error,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
  },
  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  cardName: {
    fontFamily: fonts.sansBold,
    color: colors.white,
    fontSize: 22,
    flexShrink: 1,
  },
})
