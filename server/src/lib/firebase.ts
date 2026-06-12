import { cert, getApps, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'

function initFirebaseAdmin() {
  if (getApps().length > 0) {
    return getApps()[0]
  }

  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim()
  if (json) {
    const serviceAccount = JSON.parse(json)
    return initializeApp({
      credential: cert(serviceAccount),
      projectId: serviceAccount.project_id,
    })
  }

  const projectId = process.env.FIREBASE_PROJECT_ID?.trim()
  if (projectId) {
    return initializeApp({ projectId })
  }

  return initializeApp()
}

initFirebaseAdmin()

export const db = getFirestore()
export const auth = getAuth()
