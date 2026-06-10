import React, { useEffect, useMemo } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { MOCK_PICKUP_ETA_MINUTES } from '../../constants/checkout'
import {
  getPickupDateOptions,
  getPickupTimeSlotsForDate,
  PICKUP_ASAP,
} from '../../lib/services/pickupScheduling'
import { colors, spacing, borderRadius, fonts } from '../../constants/theme'

interface PickupSchedulerProps {
  date: string
  time: string
  pickupAddress: string
  locationName?: string
  onDateChange: (date: string) => void
  onTimeChange: (time: string) => void
}

export function PickupScheduler({
  date,
  time,
  pickupAddress,
  locationName,
  onDateChange,
  onTimeChange,
}: PickupSchedulerProps) {
  const dateOptions = useMemo(() => getPickupDateOptions(), [])
  const timeSlots = useMemo(() => getPickupTimeSlotsForDate(date), [date])

  useEffect(() => {
    if (!timeSlots.includes(time as typeof timeSlots[number])) {
      onTimeChange(timeSlots[0] ?? '')
    }
  }, [date, time, timeSlots, onTimeChange])

  return (
    <View style={styles.wrap}>
      <View style={styles.locationCard}>
        <Ionicons name="location-outline" size={20} color={colors.gold} />
        <View style={styles.locationBody}>
          <Text style={styles.locationTitle}>
            {locationName ? `Pickup at ${locationName}` : 'Pickup at restaurant'}
          </Text>
          <Text style={styles.locationAddress}>{pickupAddress}</Text>
        </View>
      </View>

      <Text style={styles.fieldLabel}>Pickup date</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.dateRow}
      >
        {dateOptions.map((option) => {
          const selected = date === option.value
          return (
            <TouchableOpacity
              key={option.value}
              style={[styles.dateChip, selected && styles.chipActive]}
              onPress={() => onDateChange(option.value)}
            >
              <Text style={[styles.dateLabel, selected && styles.chipTextActive]}>
                {option.label}
              </Text>
              {option.label !== option.sublabel ? (
                <Text style={[styles.dateSub, selected && styles.chipSubActive]}>
                  {option.sublabel}
                </Text>
              ) : null}
            </TouchableOpacity>
          )
        })}
      </ScrollView>

      <Text style={styles.fieldLabel}>Pickup time</Text>
      <View style={styles.timeGrid}>
        {timeSlots.map((slot) => {
          const selected = time === slot
          const isAsap = slot === PICKUP_ASAP
          return (
            <TouchableOpacity
              key={slot}
              style={[
                styles.timeChip,
                isAsap && styles.asapChip,
                selected && styles.chipActive,
              ]}
              onPress={() => onTimeChange(slot)}
            >
              <Text style={[styles.timeText, selected && styles.chipTextActive]}>
                {isAsap ? `ASAP (~${MOCK_PICKUP_ETA_MINUTES} min)` : slot}
              </Text>
            </TouchableOpacity>
          )
        })}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  locationCard: {
    flexDirection: 'row',
    gap: spacing.sm,
    backgroundColor: colors.backgroundCard,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  locationBody: { flex: 1, gap: 4 },
  locationTitle: {
    fontFamily: fonts.sansBold,
    color: colors.white,
    fontSize: 15,
  },
  locationAddress: {
    fontFamily: fonts.sans,
    color: colors.whiteMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  fieldLabel: {
    fontFamily: fonts.sansBold,
    color: colors.white,
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: spacing.xs,
  },
  dateRow: {
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  dateChip: {
    minWidth: 88,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.backgroundCard,
    alignItems: 'center',
  },
  dateLabel: {
    fontFamily: fonts.sansBold,
    color: colors.whiteMuted,
    fontSize: 13,
  },
  dateSub: {
    fontFamily: fonts.sans,
    color: colors.whiteMuted,
    fontSize: 11,
    marginTop: 2,
  },
  timeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  timeChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.backgroundCard,
  },
  asapChip: {
    borderColor: colors.borderStrong,
  },
  chipActive: {
    backgroundColor: 'rgba(212,175,55,0.15)',
    borderColor: colors.gold,
  },
  timeText: {
    fontFamily: fonts.sansMedium,
    color: colors.whiteMuted,
    fontSize: 13,
  },
  chipTextActive: {
    fontFamily: fonts.sansBold,
    color: colors.gold,
  },
  chipSubActive: {
    color: colors.goldLight,
  },
})
