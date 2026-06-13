import React, { useState } from 'react'
import { Text, TouchableOpacity, StyleSheet, Alert } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { createUserWithEmailAndPassword, updateProfile, sendEmailVerification } from 'firebase/auth'
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore'
import { auth, db, isFirebaseConfigured } from '../../lib/firebase'
import { getAuthErrorMessage } from '../../lib/authErrors'
import { useAuthStore } from '../../store/authStore'
import { User } from '../../types/user'
import { Logo } from '../../components/brand/Logo'
import { Input, PasswordInput } from '../../components/ui/Input'
import { Button } from '../../components/ui/Button'
import { AuthScreen } from '../../components/auth/AuthScreen'
import { colors, spacing } from '../../constants/theme'
import { resolveAuthReturnPath, buildAuthReturnRoute, isCheckoutReturn } from '../../lib/authReturnTo'

export default function RegisterScreen() {
  const router = useRouter()
  const { returnTo } = useLocalSearchParams<{ returnTo?: string }>()
  const setUserProfile = useAuthStore((s) => s.setUserProfile)
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

      await setDoc(
        doc(db, 'users', cred.user.uid),
        {
          uid: cred.user.uid,
          email: email.trim(),
          phone,
          displayName: name,
          photoURL: '',
          isGuest: false,
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
      router.replace(buildAuthReturnRoute(returnTo, isCheckoutReturn(returnTo)) as never)
    } catch (e) {
      Alert.alert('Registration Failed', getAuthErrorMessage(e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthScreen>
      <Logo variant="full" height={64} style={{ alignSelf: 'center', marginBottom: spacing.xl }} />

      <Text style={styles.title}>Create Account</Text>
      <Text style={styles.sub}>Join Deccan Bawarchi for exclusive rewards</Text>

      <Input label="Full Name" value={name} onChangeText={setName} placeholder="Your name" />
      <Input label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" placeholder="you@email.com" />
      <Input label="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="+1 (555) 000-0000" />
      <PasswordInput label="Password" value={password} onChangeText={setPassword} placeholder="Min. 6 characters" />

      <Button label="Create Account" onPress={handleRegister} loading={loading} fullWidth size="lg" />

      <TouchableOpacity
        style={styles.link}
        onPress={() =>
          router.push({
            pathname: '/(auth)/login',
            params: returnTo ? { returnTo } : undefined,
          } as never)
        }
      >
        <Text style={styles.linkText}>Already have an account? <Text style={styles.bold}>Sign In</Text></Text>
      </TouchableOpacity>
    </AuthScreen>
  )
}

const styles = StyleSheet.create({
  title: { color: colors.white, fontSize: 28, fontWeight: '800', marginBottom: 6 },
  sub: { color: colors.whiteMuted, fontSize: 14, marginBottom: spacing.xl },
  link: { marginTop: spacing.md, alignItems: 'center' },
  linkText: { color: colors.whiteMuted, fontSize: 14 },
  bold: { color: colors.gold, fontWeight: '700' },
})
