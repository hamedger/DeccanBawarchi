import { FirebaseError } from 'firebase/app'

const AUTH_MESSAGES: Record<string, string> = {
  'auth/invalid-credential':
    'Incorrect email or password. If you checked out as a guest with this email, use Forgot password on the sign-in screen.',
  'auth/user-not-found':
    'No account found with this email. Register for a new account, or continue as guest at checkout.',
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

const ADMIN_AUTH_MESSAGES: Partial<typeof AUTH_MESSAGES> = {
  'auth/invalid-credential':
    'Incorrect password. Use the staff password set in Firebase Authentication.',
  'auth/user-not-found':
    'No account found with this email. Add the user under Firebase Console → Authentication → Users, or register in the app.',
}

export function getAuthErrorMessage(error: unknown, options?: { admin?: boolean }): string {
  if (error instanceof FirebaseError) {
    const messages = options?.admin ? { ...AUTH_MESSAGES, ...ADMIN_AUTH_MESSAGES } : AUTH_MESSAGES
    if (messages[error.code as keyof typeof messages]) {
      return messages[error.code as keyof typeof messages]!
    }
  }
  if (error instanceof Error && error.message) {
    return error.message
  }
  return 'Something went wrong. Please try again.'
}

export function getExistingAccountMessage(): string {
  return 'An account with this email already exists, but that password is incorrect. Sign in with the correct password, or use Forgot password if you previously checked out as a guest.'
}
