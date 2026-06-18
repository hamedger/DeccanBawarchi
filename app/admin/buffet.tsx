import React, { useEffect, useMemo, useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Switch,
  Alert,
  ActivityIndicator,
  TextInput,
  TouchableOpacity,
} from 'react-native'
import { doc, onSnapshot, updateDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { BuffetConfig } from '../../types/buffet'
import { MenuItem } from '../../types/menu'
import { Input } from '../../components/ui/Input'
import { Button } from '../../components/ui/Button'
import { AdminBuffetItemRow } from '../../components/admin/AdminBuffetItemRow'
import { colors, spacing, borderRadius, fonts } from '../../constants/theme'
import { DEFAULT_LOCATION_ID } from '../../constants/config'
import { useAdminMenu } from '../../hooks/useAdminMenu'
import { isBuffetDishServing } from '../../lib/services/buffetService'
import {
  AdminBuffetStatusFilter,
  buildAdminBuffetSections,
  buffetDishFromMenuItem,
} from '../../lib/buffetLayout'

export default function AdminBuffetScreen() {
  const [config, setConfig] = useState<BuffetConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [specialNote, setSpecialNote] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<AdminBuffetStatusFilter>('all')
  const [servingBusyId, setServingBusyId] = useState<string | null>(null)
  const [buffetBusyId, setBuffetBusyId] = useState<string | null>(null)

  const { data: menuItems = [] } = useAdminMenu()
  const locationId = DEFAULT_LOCATION_ID

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'buffet', locationId), (snap) => {
      if (snap.exists()) {
        const data = snap.data() as BuffetConfig
        setConfig(data)
        setSpecialNote(data.specialNote ?? '')
      }
      setLoading(false)
    })
    return unsub
  }, [locationId])

  const { sections, extraRows, statusCounts } = useMemo(() => {
    const filtered = buildAdminBuffetSections(
      menuItems,
      config?.todaysDishes ?? [],
      search,
      statusFilter,
    )
    const all = buildAdminBuffetSections(menuItems, config?.todaysDishes ?? [])
    const allRows = [...all.sections.flatMap((s) => s.rows), ...all.extraRows]
    return {
      ...filtered,
      statusCounts: {
        all: allRows.length,
        green: allRows.filter((r) => r.buffetDish).length,
        red: allRows.filter((r) => !r.buffetDish).length,
      },
    }
  }, [menuItems, config?.todaysDishes, search, statusFilter])

  if (loading) {
    return <ActivityIndicator color={colors.gold} style={{ flex: 1, marginTop: 80 }} />
  }

  const ref = doc(db, 'buffet', locationId)

  const toggleLunch = async (val: boolean) => {
    await updateDoc(ref, { isLunchActive: val })
  }

  const toggleDinner = async (val: boolean) => {
    await updateDoc(ref, { isDinnerActive: val })
  }

  const addDish = async (item: MenuItem) => {
    if (!config) return
    if (config.todaysDishes.find((d) => d.menuItemId === item.id)) return
    const newDish = buffetDishFromMenuItem(item, config.todaysDishes.length)
    await updateDoc(ref, {
      todaysDishes: [...config.todaysDishes, newDish],
      updatedAt: serverTimestamp(),
    })
  }

  const removeDish = async (menuItemId: string) => {
    if (!config) return
    await updateDoc(ref, {
      todaysDishes: config.todaysDishes.filter((d) => d.menuItemId !== menuItemId),
      updatedAt: serverTimestamp(),
    })
  }

  const toggleBuffetItem = async (item: MenuItem) => {
    const onBuffet = config?.todaysDishes.some((d) => d.menuItemId === item.id)
    setBuffetBusyId(item.id)
    try {
      if (onBuffet) {
        await removeDish(item.id)
      } else {
        await addDish(item)
      }
    } catch (e) {
      Alert.alert('Update failed', e instanceof Error ? e.message : 'Could not update buffet')
    } finally {
      setBuffetBusyId(null)
    }
  }

  const toggleServing = async (menuItemId: string, next: boolean) => {
    if (!config) return
    setServingBusyId(menuItemId)
    try {
      await updateDoc(ref, {
        todaysDishes: config.todaysDishes.map((d) =>
          d.menuItemId === menuItemId ? { ...d, isServing: next } : d,
        ),
        updatedAt: serverTimestamp(),
      })
    } catch (e) {
      Alert.alert('Update failed', e instanceof Error ? e.message : 'Could not update serving status')
    } finally {
      setServingBusyId(null)
    }
  }

  const saveNote = async () => {
    setSaving(true)
    await updateDoc(ref, { specialNote, updatedAt: serverTimestamp() })
    setSaving(false)
    Alert.alert('Saved', 'Buffet note updated')
  }

  const onBuffetCount = config?.todaysDishes.length ?? 0
  const servingCount =
    config?.todaysDishes.filter((d) => isBuffetDishServing(d)).length ?? 0

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>Buffet</Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Sessions</Text>
        <View style={styles.card}>
          <ToggleRow
            label="Lunch active"
            value={config?.isLunchActive ?? false}
            onChange={toggleLunch}
          />
          <ToggleRow
            label="Dinner active"
            value={config?.isDinnerActive ?? false}
            onChange={toggleDinner}
          />
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            Today&apos;s buffet ({servingCount} serving · {onBuffetCount} on menu)
          </Text>
          <Text style={styles.legendHint}>
            Green circle = on today&apos;s menu · Serving switch = visible on the customer buffet page
          </Text>
        </View>
        <View style={styles.filterRow}>
          {(
            [
              { key: 'all', label: 'All' },
              { key: 'red', label: 'Red', dot: colors.error },
              { key: 'green', label: 'Green', dot: colors.green },
            ] as const
          ).map(({ key, label, dot }) => {
            const active = statusFilter === key
            return (
              <TouchableOpacity
                key={key}
                style={[styles.filterChip, active && styles.filterChipActive]}
                onPress={() => setStatusFilter(key)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
              >
                {dot ? <View style={[styles.filterDot, { backgroundColor: dot }]} /> : null}
                <Text style={[styles.filterChipLabel, active && styles.filterChipLabelActive]}>
                  {label}
                </Text>
                <View style={[styles.filterBadge, active && styles.filterBadgeActive]}>
                  <Text style={[styles.filterBadgeText, active && styles.filterBadgeTextActive]}>
                    {statusCounts[key]}
                  </Text>
                </View>
              </TouchableOpacity>
            )
          })}
        </View>

        <TextInput
          style={styles.search}
          value={search}
          onChangeText={setSearch}
          placeholder="Search buffet items..."
          placeholderTextColor={colors.whiteMuted}
        />

        {sections.length === 0 && extraRows.length === 0 ? (
          <View style={styles.card}>
            <Text style={styles.hint}>No items match this filter.</Text>
          </View>
        ) : null}

        {sections.map((section) => (
          <View key={section.id} style={styles.categorySection}>
            <Text style={styles.categoryTitle}>{section.title}</Text>
            <View style={styles.card}>
              {section.rows.length === 0 ? (
                <Text style={styles.hint}>No matches in this section.</Text>
              ) : (
                section.rows.map((row) => (
                  <AdminBuffetItemRow
                    key={row.menuItemId}
                    row={row}
                    buffetBusy={buffetBusyId === row.menuItemId}
                    servingBusy={servingBusyId === row.menuItemId}
                    onToggleBuffet={toggleBuffetItem}
                    onToggleServing={toggleServing}
                  />
                ))
              )}
            </View>
          </View>
        ))}

        {extraRows.length > 0 ? (
          <View style={styles.categorySection}>
            <Text style={styles.categoryTitle}>More menu items</Text>
            <View style={styles.card}>
              {extraRows.map((row) => (
                <AdminBuffetItemRow
                  key={row.menuItemId}
                  row={row}
                  buffetBusy={buffetBusyId === row.menuItemId}
                  servingBusy={servingBusyId === row.menuItemId}
                  onToggleBuffet={toggleBuffetItem}
                  onToggleServing={toggleServing}
                />
              ))}
            </View>
          </View>
        ) : null}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Special note</Text>
        <Input
          value={specialNote}
          onChangeText={setSpecialNote}
          placeholder="e.g. Eid Special — Extra dishes today!"
          multiline
        />
        <Button label="Save Note" onPress={saveNote} loading={saving} />
      </View>
    </ScrollView>
  )
}

function ToggleRow({
  label,
  value,
  onChange,
}: {
  label: string
  value: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <View style={styles.toggleRow}>
      <Text style={styles.toggleLabel}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onChange}
        thumbColor={value ? colors.gold : colors.whiteMuted}
        trackColor={{ true: colors.goldDark, false: colors.border }}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    padding: spacing.lg,
    maxWidth: 960,
    alignSelf: 'center',
    width: '100%',
    paddingBottom: spacing.xxl,
  },
  heading: {
    fontFamily: fonts.serif,
    color: colors.gold,
    fontSize: 28,
    marginBottom: spacing.md,
  },
  section: { marginBottom: spacing.lg },
  sectionHeader: {
    marginBottom: spacing.sm,
    gap: spacing.xs,
  },
  sectionTitle: {
    fontFamily: fonts.sansBold,
    color: colors.white,
    fontSize: 15,
  },
  legendHint: {
    fontFamily: fonts.sans,
    color: colors.whiteMuted,
    fontSize: 11,
    lineHeight: 16,
  },
  categorySection: {
    marginBottom: spacing.md,
  },
  categoryTitle: {
    fontFamily: fonts.sansBold,
    color: colors.goldLight,
    fontSize: 13,
    letterSpacing: 0.4,
    marginBottom: spacing.xs,
    textTransform: 'uppercase',
  },
  card: {
    backgroundColor: colors.backgroundCard,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  hint: {
    fontFamily: fonts.sans,
    color: colors.whiteMuted,
    fontSize: 13,
    padding: spacing.md,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 4,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.backgroundSecondary,
  },
  filterChipActive: {
    borderColor: colors.gold,
    backgroundColor: 'rgba(212,175,55,0.18)',
  },
  filterDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  filterChipLabel: {
    fontFamily: fonts.sansMedium,
    color: colors.white,
    fontSize: 14,
  },
  filterChipLabelActive: {
    color: colors.goldBright,
  },
  filterBadge: {
    minWidth: 22,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    alignItems: 'center',
  },
  filterBadgeActive: {
    backgroundColor: colors.gold,
    borderColor: colors.gold,
  },
  filterBadgeText: {
    fontFamily: fonts.sansBold,
    color: colors.goldLight,
    fontSize: 11,
  },
  filterBadgeTextActive: {
    color: colors.background,
  },
  search: {
    fontFamily: fonts.sans,
    color: colors.white,
    fontSize: 14,
    backgroundColor: colors.backgroundCard,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  toggleLabel: {
    fontFamily: fonts.sansMedium,
    color: colors.white,
    fontSize: 15,
  },
})
