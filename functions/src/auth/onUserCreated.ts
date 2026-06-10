import * as functions from 'firebase-functions/v1'
import * as admin from 'firebase-admin'
import { WELCOME_BONUS_POINTS } from '../constants/loyalty'

if (!admin.apps.length) admin.initializeApp()
const db = admin.firestore()

export const onUserCreated = functions.auth.user().onCreate(async (user) => {
  const isGuest = user.isAnonymous

  await db.collection('users').doc(user.uid).set(
    {
      uid: user.uid,
      email: user.email ?? '',
      displayName: user.displayName ?? '',
      photoURL: user.photoURL ?? '',
      isGuest,
      addresses: [],
      defaultAddressId: '',
      loyaltyPoints: isGuest ? 0 : WELCOME_BONUS_POINTS,
      loyaltyTier: 'bronze',
      totalOrderCount: 0,
      totalSpend: 0,
      dietaryPreferences: [],
      pushToken: '',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true },
  )
})
