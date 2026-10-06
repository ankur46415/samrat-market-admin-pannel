import { cert, getApps, initializeApp, type App } from "firebase-admin/app"
import { getAuth } from "firebase-admin/auth"
import { getFirestore } from "firebase-admin/firestore"

function initAdminApp(): App {
  const existing = getApps()[0]
  if (existing) return existing

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim()
  if (!raw) {
    throw new Error(
      "FIREBASE_SERVICE_ACCOUNT_JSON is not set. Add your Firebase service account JSON in Vercel env."
    )
  }
  const serviceAccount = JSON.parse(raw) as Record<string, string>
  return initializeApp({
    credential: cert(serviceAccount),
  })
}

export function adminAuth() {
  initAdminApp()
  return getAuth()
}

export function adminDb() {
  initAdminApp()
  return getFirestore()
}
