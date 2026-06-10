import React, { useState } from 'react'
import { View, Text, ScrollView, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { signInAnonymously, updateProfile } from 'firebase/auth'
import { doc, setDoc, serverTimestamp } from 'firebase/firestore'
import { auth, db } from '../../lib/firebase'
import { Logo } from '../../components/brand/Logo'
import { Input } from '../../components/ui/Input'
import { Button } from '../../components/ui/Button'
import { colors, spacing } from '../../constants/theme'

export default function GuestScreen() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)

  const handleContinue = async () => {
    if (!name || !email || !phone) return
    setLoading(true)
    try {
      const cred = await signInAnonymously(auth)
      await updateProfile(cred.user, { displayName: name })
      await setDoc(doc(db, 'users', cred.user.uid), {
        uid: cred.user.uid,
        email: email.trim(),
        phone,
        displayName: name,
        isGuest: true,
        loyaltyPoints: 0,
        loyaltyTier: 'bronze',
        totalOrderCount: 0,
        totalSpend: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
      router.back()
    } catch (e: any) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Logo variant="full" height={64} style={{ alignSelf: 'center', marginBottom: spacing.xl }} />
      <Text style={styles.title}>Guest Checkout</Text>
      <Text style={styles.sub}>We need your details to send order updates</Text>

      <Input label="Full Name" value={name} onChangeText={setName} placeholder="Your name" />
      <Input label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" placeholder="for order receipt" />
      <Input label="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="for delivery updates" />

      <Button label="Continue to Checkout" onPress={handleContinue} loading={loading} fullWidth size="lg" />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.xl, paddingTop: spacing.xxl },
  title: { color: colors.white, fontSize: 28, fontWeight: '800', marginBottom: 6 },
  sub: { color: colors.whiteMuted, fontSize: 14, marginBottom: spacing.xl },
})
