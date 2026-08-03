import React, { useEffect, useRef } from 'react'
import { Modal, Platform, Text, TouchableOpacity, View, StyleSheet } from 'react-native'
import { useAdminOrderAlerts } from '../../hooks/useAdminOrderAlerts'
import { playKitchenChime } from '../../lib/admin/kitchenChime'
import { formatOrderAlertBody, formatOrderAlertTitle } from '../../lib/admin/orderAlerts'
import { resolveOrderCustomerInfo, OrderCustomerProfile } from '../../lib/admin/orderAdmin'
import { Order } from '../../types/order'
import { colors, spacing, borderRadius, fonts } from '../../constants/theme'

const CHIME_REPEAT_MS = 8000

interface AdminOrderAlertsProps {
  orders: Order[]
  loading: boolean
  customerProfiles: Map<string, OrderCustomerProfile>
}

/**
 * Listens for newly paid orders across admin pages and blocks with a popup +
 * repeating chime until staff acknowledges it. Deliberately not dismissible
 * except via the OK button (no backdrop tap, no Escape/back) — autoprint at
 * Clover isn't reliable, so this is the fallback for staff actually noticing
 * a new order came in.
 */
export function AdminOrderAlerts({ orders, loading, customerProfiles }: AdminOrderAlertsProps) {
  const enabled = Platform.OS === 'web'
  const { queue, dismissCurrent } = useAdminOrderAlerts(orders, loading, enabled)
  const current = queue[0] ?? null

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!current) return

    playKitchenChime()
    intervalRef.current = setInterval(playKitchenChime, CHIME_REPEAT_MS)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [current])

  if (!enabled || !current) return null

  const customer = resolveOrderCustomerInfo(current, customerProfiles)

  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => {}}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.eyebrow}>New Order</Text>
          <Text style={styles.title}>{formatOrderAlertTitle(current)}</Text>
          <Text style={styles.body}>{formatOrderAlertBody(current, customer.name)}</Text>
          {queue.length > 1 ? (
            <Text style={styles.queueNote}>{queue.length - 1} more waiting</Text>
          ) : null}
          <TouchableOpacity style={styles.button} onPress={dismissCurrent}>
            <Text style={styles.buttonText}>OK</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: colors.backgroundCard,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.gold,
    padding: spacing.xl,
    alignItems: 'center',
  },
  eyebrow: {
    fontFamily: fonts.sansMedium,
    color: colors.gold,
    fontSize: 12,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
  },
  title: {
    fontFamily: fonts.sansBold,
    color: colors.white,
    fontSize: 22,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  body: {
    fontFamily: fonts.sans,
    color: colors.whiteMuted,
    fontSize: 15,
    textAlign: 'center',
  },
  queueNote: {
    fontFamily: fonts.sans,
    color: colors.gold,
    fontSize: 12,
    marginTop: spacing.sm,
  },
  button: {
    marginTop: spacing.lg,
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.gold,
    minWidth: 140,
    alignItems: 'center',
  },
  buttonText: {
    fontFamily: fonts.sansBold,
    color: colors.background,
    fontSize: 16,
  },
})
