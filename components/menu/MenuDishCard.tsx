import React from 'react'
import { View, Text, Pressable, TouchableOpacity, StyleSheet } from 'react-native'
import { Image } from 'expo-image'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { MenuItem } from '../../types/menu'
import { getDishImageUrl } from '../../lib/menuImages'
import { useCartStore } from '../../store/cartStore'
import { colors, spacing, borderRadius, fonts } from '../../constants/theme'

interface MenuDishCardProps {
  item: MenuItem
  width: number
}

export function MenuDishCard({ item, width }: MenuDishCardProps) {
  const router = useRouter()
  const quantity = useCartStore(
    (s) => s.items.find((i) => i.menuItemId === item.id)?.quantity ?? 0,
  )
  const addItem = useCartStore((s) => s.addItem)
  const updateQuantity = useCartStore((s) => s.updateQuantity)

  const price = `$${(item.price / 100).toFixed(2)}`
  const imageUri = item.imageURL || getDishImageUrl(item.id, item.name, item.category)
  const imageHeight = Math.round(width * 0.58)

  const openDetail = () => router.push(`/menu/${item.id}` as never)

  const increment = () => {
    if (quantity === 0) {
      addItem({
        menuItemId: item.id,
        name: item.name,
        price: item.price,
        imageURL: item.imageURL,
      })
    } else {
      updateQuantity(item.id, quantity + 1)
    }
  }

  const decrement = () => updateQuantity(item.id, quantity - 1)

  return (
    <View style={[styles.card, { width }]}>
      <Pressable
        onPress={openDetail}
        accessibilityRole="button"
        accessibilityLabel={`${item.name}, ${price}`}
      >
        <Image
          source={{ uri: imageUri }}
          style={[styles.image, { width, height: imageHeight }]}
          contentFit="cover"
          transition={200}
          accessibilityIgnoresInvertColors
        />
        <View style={styles.body}>
          <Text style={styles.name} numberOfLines={2}>
            {item.name}
          </Text>
          <View style={styles.priceRow}>
            <Text style={styles.price}>{price}</Text>
            {item.tags.includes('bestseller') && <Text style={styles.badge}>★</Text>}
          </View>
        </View>
      </Pressable>

      <View style={styles.qtyBar}>
        <TouchableOpacity
          style={[styles.qtyBtn, quantity === 0 && styles.qtyBtnDisabled]}
          onPress={decrement}
          disabled={quantity === 0}
          accessibilityRole="button"
          accessibilityState={{ disabled: quantity === 0 }}
          accessibilityLabel={`Decrease ${item.name} quantity`}
        >
          <Ionicons
            name="remove"
            size={14}
            color={quantity === 0 ? colors.whiteMuted : colors.gold}
          />
        </TouchableOpacity>
        <Text style={[styles.qty, quantity === 0 && styles.qtyZero]}>{quantity}</Text>
        <TouchableOpacity
          style={styles.qtyBtn}
          onPress={increment}
          accessibilityRole="button"
          accessibilityLabel={`Increase ${item.name} quantity`}
        >
          <Ionicons name="add" size={14} color={colors.gold} />
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.sm,
    overflow: 'hidden',
  },
  image: {
    backgroundColor: colors.backgroundSecondary,
  },
  body: {
    paddingHorizontal: spacing.xs + 2,
    paddingTop: spacing.xs + 2,
    paddingBottom: spacing.xs,
    gap: 2,
  },
  name: {
    fontFamily: fonts.sansMedium,
    color: colors.white,
    fontSize: 11,
    lineHeight: 14,
    minHeight: 28,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 4,
  },
  price: {
    fontFamily: fonts.sansMedium,
    color: colors.gold,
    fontSize: 12,
  },
  badge: {
    fontFamily: fonts.sans,
    color: colors.goldLight,
    fontSize: 10,
  },
  qtyBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingVertical: spacing.xs,
    minHeight: 32,
    gap: spacing.sm,
  },
  qtyBtn: {
    width: 28,
    height: 28,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyBtnDisabled: {
    opacity: 0.45,
  },
  qty: {
    fontFamily: fonts.sansMedium,
    color: colors.white,
    fontSize: 13,
    minWidth: 20,
    textAlign: 'center',
  },
  qtyZero: {
    color: colors.whiteMuted,
  },
})
