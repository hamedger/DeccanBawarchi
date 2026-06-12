import { doc, getDoc, serverTimestamp, updateDoc } from 'firebase/firestore'
import { db } from './firebase'
import { isFirestorePermissionDenied } from './firestoreErrors'

export interface GuestProfileInput {
  email: string
  phone: string
  displayName: string
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Wait for the Auth onCreate trigger to write the base users/{uid} document. */
export async function waitForUserDoc(uid: string, maxMs = 8000): Promise<boolean> {
  const ref = doc(db, 'users', uid)
  const started = Date.now()

  while (Date.now() - started < maxMs) {
    const snap = await getDoc(ref)
    if (snap.exists()) return true
    await sleep(300)
  }

  return false
}

/** Patch guest contact info onto the server-created profile (update-only, no protected fields). */
export async function patchGuestProfile(uid: string, profile: GuestProfileInput): Promise<void> {
  const ready = await waitForUserDoc(uid)
  if (!ready) {
    throw new Error('Could not prepare your guest profile. Please try again in a moment.')
  }

  const ref = doc(db, 'users', uid)
  await updateDoc(ref, {
    email: profile.email.trim(),
    phone: profile.phone.trim(),
    displayName: profile.displayName.trim(),
    isGuest: true,
    updatedAt: serverTimestamp(),
  })
}

export function isGuestProfileWriteError(error: unknown): boolean {
  return isFirestorePermissionDenied(error)
}
