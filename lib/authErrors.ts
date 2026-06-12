import { FirebaseError } from 'firebase/app'

const AUTH_MESSAGES: Record<string, string> = {
  'auth/invalid-credential':
    'Incorrect password. Use the staff password set in Firebase Authentication.',
  'auth/user-not-found':
    'No account found with this email. Add the user under Firebase Console → Authentication → Users, or register in the app.',
  'auth/wrong-password': 'Incorrect password.',
  'auth/invalid-email': 'Please enter a valid email address.',
  'auth/user-disabled': 'This account has been disabled.',
  'auth/too-many-requests': 'Too many attempts. Wait a few minutes and try again.',
  'auth/operation-not-allowed':
    'This sign-in method is not enabled. In Firebase Console → Authentication → Sign-in method, enable Email/Password (and optionally Anonymous for guest checkout).',
  'auth/network-request-failed': 'Network error. Check your connection and try again.',
  'auth/missing-password': 'Please enter your password.',
  'auth/weak-password': 'Password must be at least 6 characters.',
  'auth/email-already-in-use': 'An account with this email already exists. Try signing in instead.',
  'auth/admin-restricted-operation':
    'Guest checkout could not start. Enable Anonymous sign-in in Firebase, or use Email/Password sign-in.',
}

export function getAuthErrorMessage(error: unknown): string {
  if (error instanceof FirebaseError && AUTH_MESSAGES[error.code]) {
    return AUTH_MESSAGES[error.code]
  }
  if (error instanceof Error && error.message) {
    return error.message
  }
  return 'Something went wrong. Please try again.'
}
