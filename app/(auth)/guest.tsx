import React, { useState } from 'react'
import { Text, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { signInAnonymously, updateProfile } from 'firebase/auth'
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore'
import { auth, db } from '../../lib/firebase'
import { useAuthStore } from '../../store/authStore'
import { User } from '../../types/user'
import { Logo } from '../../components/brand/Logo'
import { Input } from '../../components/ui/Input'
import { Button } from '../../components/ui/Button'
import { AuthScreen } from '../../components/auth/AuthScreen'
import { colors, spacing } from '../../constants/theme'

export default function GuestScreen() {
  const router = useRouter()
  const setUserProfile = useAuthStore((s) => s.setUserProfile)
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

      await setDoc(
        doc(db, 'users', cred.user.uid),
        {
          uid: cred.user.uid,
          email: email.trim(),
          phone,
          displayName: name,
          photoURL: '',
          isGuest: true,
          addresses: [],
          defaultAddressId: '',
          dietaryPreferences: [],
          pushToken: '',
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      )
      const snap = await getDoc(doc(db, 'users', cred.user.uid))
      if (snap.exists()) setUserProfile(snap.data() as User)
      router.back()
    } catch (e: unknown) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthScreen>
      <Logo variant="full" height={64} style={{ alignSelf: 'center', marginBottom: spacing.xl }} />
      <Text style={styles.title}>Guest Checkout</Text>
      <Text style={styles.sub}>We need your details to send order updates</Text>

      <Input label="Full Name" value={name} onChangeText={setName} placeholder="Your name" />
      <Input label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" placeholder="for order receipt" />
      <Input label="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="for delivery updates" />

      <Button label="Continue to Checkout" onPress={handleContinue} loading={loading} fullWidth size="lg" />
    </AuthScreen>
  )
}

const styles = StyleSheet.create({
  title: { color: colors.white, fontSize: 28, fontWeight: '800', marginBottom: 6 },
  sub: { color: colors.whiteMuted, fontSize: 14, marginBottom: spacing.xl },
})
