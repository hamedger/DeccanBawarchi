import React, { useEffect, useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import { useMenuItem } from '../../hooks/useMenu'
import { useCartStore } from '../../store/cartStore'
import { getDishImageUrl } from '../../lib/menuImages'
import { colors, spacing, borderRadius, fonts } from '../../constants/theme'
import { Badge } from '../../components/ui/Badge'
import { HalalBadge } from '../../components/brand/HalalBadge'
import { Button } from '../../components/ui/Button'

const CONTENT_MAX = 640
const SPICE_ICONS = ['', '🌶️', '🌶️🌶️', '🌶️🌶️🌶️']

export default function ItemDetailScreen() {
  const { itemId } = useLocalSearchParams<{ itemId: string }>()
  const router = useRouter()
  const { width: windowWidth } = useWindowDimensions()
  const { data: item, isLoading } = useMenuItem(itemId)

  const cartQty = useCartStore(
    (s) => s.items.find((i) => i.menuItemId === itemId)?.quantity ?? 0,
  )
  const addItem = useCartStore((s) => s.addItem)
  const updateQuantity = useCartStore((s) => s.updateQuantity)

  const [qty, setQty] = useState(1)

  useEffect(() => {
    setQty(cartQty > 0 ? cartQty : 1)
  }, [cartQty, itemId])

  const contentWidth = Math.min(windowWidth, CONTENT_MAX)
  const imageHeight = Math.round(contentWidth * 0.56)

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.gold} size="large" />
      </View>
    )
  }

  if (!item) {
    return (
      <View style={styles.centered}>
        <Text style={styles.notFound}>Item not found</Text>
      </View>
    )
  }

  const imageUri = item.imageURL || getDishImageUrl(item.id, item.name, item.category)
  const unitPrice = (item.price / 100).toFixed(2)
  const lineTotal = ((item.price * qty) / 100).toFixed(2)

  const decrement = () => setQty((n) => Math.max(1, n - 1))
  const increment = () => setQty((n) => n + 1)

  const handleAddToCart = () => {
    if (cartQty > 0) {
      updateQuantity(item.id, qty)
    } else {
      addItem({
        menuItemId: item.id,
        name: item.name,
        price: item.price,
        imageURL: imageUri,
      })
      if (qty > 1) updateQuantity(item.id, qty)
    }
    router.back()
  }

  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.sheet, { maxWidth: CONTENT_MAX }]}>
          <View style={[styles.imageFrame, { width: contentWidth, height: imageHeight }]}>
            <Image
              source={{ uri: imageUri }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              transition={200}
              accessibilityIgnoresInvertColors
            />
          </View>

          <View style={styles.body}>
            <Text style={styles.name}>{item.name}</Text>
            <Text style={styles.price}>${unitPrice}</Text>

            {(item.isVegetarian || item.isHalal || item.isSpicy || item.tags?.includes('bestseller')) && (
              <View style={styles.badgeRow}>
                {item.isVegetarian && <Badge label="VEG" variant="green" size="md" />}
                {item.isHalal && <HalalBadge size="sm" />}
                {item.isSpicy && (
                  <Badge label={SPICE_ICONS[item.spiceLevel]} variant="red" size="md" />
                )}
                {item.tags?.includes('bestseller') && (
                  <Badge label="BESTSELLER" variant="gold" size="md" />
                )}
              </View>
            )}

            {item.description ? (
              <Text style={styles.desc}>{item.description}</Text>
            ) : null}

            {!!item.calories && item.calories > 0 && (
              <Text style={styles.calories}>{item.calories} cal</Text>
            )}

            {item.allergens?.length > 0 && (
              <View style={styles.infoBlock}>
                <Text style={styles.infoLabel}>Allergens</Text>
                <Text style={styles.infoValue}>{item.allergens.join(', ')}</Text>
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <View style={[styles.footerInner, { maxWidth: CONTENT_MAX }]}>
          <View style={styles.qtyRow}>
            <TouchableOpacity
              style={[styles.qtyBtn, qty <= 1 && styles.qtyBtnDisabled]}
              onPress={decrement}
              disabled={qty <= 1}
              accessibilityRole="button"
              accessibilityState={{ disabled: qty <= 1 }}
              accessibilityLabel="Decrease quantity"
            >
              <Ionicons
                name="remove"
                size={18}
                color={qty <= 1 ? colors.whiteMuted : colors.gold}
              />
            </TouchableOpacity>
            <Text style={styles.qtyValue}>{qty}</Text>
            <TouchableOpacity
              style={styles.qtyBtn}
              onPress={increment}
              accessibilityRole="button"
              accessibilityLabel="Increase quantity"
            >
              <Ionicons name="add" size={18} color={colors.gold} />
            </TouchableOpacity>
          </View>

          <Button
            label={cartQty > 0 ? `Update Cart · $${lineTotal}` : `Add to Cart · $${lineTotal}`}
            onPress={handleAddToCart}
            size="lg"
            style={styles.addBtn}
          />
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    alignItems: 'center',
    paddingBottom: spacing.xl,
  },
  sheet: {
    width: '100%',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  notFound: {
    fontFamily: fonts.sans,
    color: colors.whiteMuted,
    fontSize: 16,
  },
  imageFrame: {
    alignSelf: 'center',
    backgroundColor: colors.backgroundSecondary,
    overflow: 'hidden',
  },
  body: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    gap: spacing.sm,
  },
  name: {
    fontFamily: fonts.serif,
    color: colors.white,
    fontSize: 26,
    lineHeight: 32,
  },
  price: {
    fontFamily: fonts.sansMedium,
    color: colors.gold,
    fontSize: 22,
    letterSpacing: 0.3,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  desc: {
    fontFamily: fonts.sans,
    color: colors.whiteMuted,
    fontSize: 15,
    lineHeight: 24,
    marginTop: spacing.sm,
  },
  calories: {
    fontFamily: fonts.sans,
    color: colors.whiteMuted,
    fontSize: 13,
  },
  infoBlock: {
    marginTop: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.backgroundCard,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  infoLabel: {
    fontFamily: fonts.sansBold,
    color: colors.gold,
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
  },
  infoValue: {
    fontFamily: fonts.sans,
    color: colors.whiteMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.backgroundSecondary,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    alignItems: 'center',
  },
  footerInner: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  qtyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  qtyBtn: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyBtnDisabled: {
    opacity: 0.45,
  },
  qtyValue: {
    fontFamily: fonts.sansMedium,
    color: colors.white,
    fontSize: 18,
    minWidth: 28,
    textAlign: 'center',
  },
  addBtn: {
    flex: 1,
  },
})
