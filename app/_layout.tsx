import React, { useEffect, useCallback } from 'react'
import { View, Platform } from 'react-native'
import { Stack, usePathname } from 'expo-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StatusBar } from 'expo-status-bar'
import * as SplashScreen from 'expo-splash-screen'
import { onAuthStateChanged, getIdTokenResult } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db, isFirebaseConfigured } from '../lib/firebase'
import { useAuthStore } from '../store/authStore'
import { User } from '../types/user'
import { colors } from '../constants/theme'
import { useAppFonts } from '../lib/fonts'
import { blurActiveElementOnWeb } from '../lib/a11y'
import { isAdminUser } from '../lib/adminAuth'

SplashScreen.preventAutoHideAsync()

const queryClient = new QueryClient()

export default function RootLayout() {
  const [fontsLoaded] = useAppFonts()
  const pathname = usePathname()
  const { setFirebaseUser, setUserProfile, setLoading, setAdmin } = useAuthStore()

  useEffect(() => {
    blurActiveElementOnWeb()
  }, [pathname])

  useEffect(() => {
    if (!isFirebaseConfigured) {
      setLoading(false)
      return
    }
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      setFirebaseUser(firebaseUser)
      if (firebaseUser) {
        await firebaseUser.getIdToken(true)
        const tokenResult = await getIdTokenResult(firebaseUser)
        setAdmin(isAdminUser(firebaseUser, tokenResult.claims))
        try {
          const snap = await getDoc(doc(db, 'users', firebaseUser.uid))
          if (snap.exists()) setUserProfile(snap.data() as User)
        } catch {
          setUserProfile(null)
        }
      } else {
        setUserProfile(null)
        setAdmin(false)
      }
      setLoading(false)
    })
    return unsub
  }, [])

  const onLayoutReady = useCallback(async () => {
    if (fontsLoaded) {
      await SplashScreen.hideAsync()
    }
  }, [fontsLoaded])

  if (!fontsLoaded) {
    return null
  }

  return (
    <QueryClientProvider client={queryClient}>
      <View style={{ flex: 1 }} onLayout={onLayoutReady}>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: colors.background },
            headerTintColor: colors.gold,
            headerTitleStyle: { color: colors.white, fontWeight: '700' },
            contentStyle: { backgroundColor: colors.background },
            headerShadowVisible: false,
          }}
        >
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
          <Stack.Screen name="menu/[itemId]" options={{ title: '' }} />
          <Stack.Screen name="checkout/index" options={{ title: 'Checkout' }} />
          <Stack.Screen name="checkout/delivery" options={{ title: 'Delivery Details' }} />
          <Stack.Screen name="checkout/payment" options={{ title: 'Payment' }} />
          <Stack.Screen name="checkout/success" options={{ title: 'Order Confirmed', headerShown: false }} />
          <Stack.Screen name="order/[orderId]" options={{ title: 'Order Tracking' }} />
          <Stack.Screen name="reservation" options={{ title: 'Reserve a Table' }} />
          <Stack.Screen name="catering" options={{ title: 'Catering Inquiry' }} />
          <Stack.Screen name="loyalty" options={{ title: 'My Rewards' }} />
          <Stack.Screen name="admin" options={{ headerShown: false }} />
        </Stack>
      </View>
    </QueryClientProvider>
  )
}
