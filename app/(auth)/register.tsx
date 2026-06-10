import React, { useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert } from 'react-native'
import { useRouter } from 'expo-router'
import { createUserWithEmailAndPassword, updateProfile, sendEmailVerification } from 'firebase/auth'
import { doc, setDoc, serverTimestamp } from 'firebase/firestore'
import { auth, db, isFirebaseConfigured } from '../../lib/firebase'
import { getAuthErrorMessage } from '../../lib/authErrors'
import { Logo } from '../../components/brand/Logo'
import { Input, PasswordInput } from '../../components/ui/Input'
import { Button } from '../../components/ui/Button'
import { colors, spacing } from '../../constants/theme'

export default function RegisterScreen() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)

  const handleRegister = async () => {
    if (!name || !email || !password) {
      Alert.alert('Missing fields', 'Name, email, and password are required.')
      return
    }
    if (password.length < 6) {
      Alert.alert('Weak password', 'Password must be at least 6 characters.')
      return
    }
    if (!isFirebaseConfigured) {
      Alert.alert('Configuration error', 'Firebase is not configured. Check your .env file and restart the app.')
      return
    }
    setLoading(true)
    try {
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password)
      await updateProfile(cred.user, { displayName: name })
      await sendEmailVerification(cred.user)
      await setDoc(doc(db, 'users', cred.user.uid), {
        uid: cred.user.uid,
        email: email.trim(),
        phone,
        displayName: name,
        photoURL: '',
        isGuest: false,
        addresses: [],
        defaultAddressId: '',
        loyaltyPoints: 100,
        loyaltyTier: 'bronze',
        totalOrderCount: 0,
        totalSpend: 0,
        dietaryPreferences: [],
        pushToken: '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
      router.replace('/(tabs)/' as any)
    } catch (e) {
      Alert.alert('Registration Failed', getAuthErrorMessage(e))
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

      <Text style={styles.title}>Create Account</Text>
      <Text style={styles.sub}>Join Deccan Bawarchi for exclusive rewards</Text>

      <Input label="Full Name" value={name} onChangeText={setName} placeholder="Your name" />
      <Input label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" placeholder="you@email.com" />
      <Input label="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="+1 (555) 000-0000" />
      <PasswordInput label="Password" value={password} onChangeText={setPassword} placeholder="Min. 8 characters" />

      <Button label="Create Account" onPress={handleRegister} loading={loading} fullWidth size="lg" />

      <TouchableOpacity style={styles.link} onPress={() => router.push('/(auth)/login' as any)}>
        <Text style={styles.linkText}>Already have an account? <Text style={styles.bold}>Sign In</Text></Text>
      </TouchableOpacity>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.xl, paddingTop: spacing.xxl },
  title: { color: colors.white, fontSize: 28, fontWeight: '800', marginBottom: 6 },
  sub: { color: colors.whiteMuted, fontSize: 14, marginBottom: spacing.xl },
  link: { marginTop: spacing.md, alignItems: 'center' },
  linkText: { color: colors.whiteMuted, fontSize: 14 },
  bold: { color: colors.gold, fontWeight: '700' },
})
