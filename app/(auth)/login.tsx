import React, { useState } from 'react'
import { Text, TouchableOpacity, StyleSheet, Alert } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { signInWithEmailAndPassword } from 'firebase/auth'
import { auth, isFirebaseConfigured } from '../../lib/firebase'
import { getAuthErrorMessage } from '../../lib/authErrors'
import { Logo } from '../../components/brand/Logo'
import { Input, PasswordInput } from '../../components/ui/Input'
import { Button } from '../../components/ui/Button'
import { AuthScreen } from '../../components/auth/AuthScreen'
import { colors, spacing } from '../../constants/theme'
import { CHECKOUT_RETURN_PATH, resolveAuthReturnPath } from '../../lib/authReturnTo'

export default function LoginScreen() {
  const router = useRouter()
  const { returnTo } = useLocalSearchParams<{ returnTo?: string }>()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const fromCheckout = returnTo === CHECKOUT_RETURN_PATH

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Missing fields', 'Enter your email and password.')
      return
    }
    if (!isFirebaseConfigured) {
      Alert.alert('Configuration error', 'Firebase is not configured. Check your .env file and restart the app.')
      return
    }
    setLoading(true)
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password)
      router.replace(resolveAuthReturnPath(returnTo) as never)
    } catch (e) {
      Alert.alert('Login Failed', getAuthErrorMessage(e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthScreen>
      <Logo variant="full" height={64} style={{ alignSelf: 'center', marginBottom: spacing.xl }} />

      <Text style={styles.title}>{fromCheckout ? 'Sign In to Pay' : 'Welcome Back'}</Text>
      <Text style={styles.sub}>
        {fromCheckout
          ? 'Sign in, register, or continue as guest to complete your order'
          : 'Sign in to your account'}
      </Text>

      <Input
        label="Email"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        placeholder="you@email.com"
      />
      <PasswordInput
        label="Password"
        value={password}
        onChangeText={setPassword}
      />

      <Button label="Sign In" onPress={handleLogin} loading={loading} fullWidth size="lg" />

      <TouchableOpacity
        style={styles.link}
        onPress={() =>
          router.push({
            pathname: '/(auth)/register',
            params: returnTo ? { returnTo } : undefined,
          } as never)
        }
      >
        <Text style={styles.linkText}>
          Don&apos;t have an account? <Text style={styles.linkBold}>Register</Text>
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.link}
        onPress={() =>
          router.push({
            pathname: '/(auth)/guest',
            params: returnTo ? { returnTo } : undefined,
          } as never)
        }
      >
        <Text style={styles.linkText}>
          Continue as <Text style={styles.linkBold}>Guest</Text>
        </Text>
      </TouchableOpacity>
    </AuthScreen>
  )
}

const styles = StyleSheet.create({
  title: { color: colors.white, fontSize: 28, fontWeight: '800', marginBottom: 6 },
  sub: { color: colors.whiteMuted, fontSize: 14, marginBottom: spacing.xl, textAlign: 'center' },
  link: { marginTop: spacing.md, alignItems: 'center' },
  linkText: { color: colors.whiteMuted, fontSize: 14 },
  linkBold: { color: colors.gold, fontWeight: '700' },
})
