import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app"
import { getFirestore, Firestore } from "firebase/firestore"
import { getAuth, Auth } from "firebase/auth"

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
}

// Initialize Firebase
let app: FirebaseApp
let db: Firestore
let auth: Auth

if (typeof window !== "undefined") {
  // Client side initialization
  app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp()
  db = getFirestore(app)
  auth = getAuth(app)
} else {
  // Server side: Prevent SSR execution and provide safe placeholders for build time
  // This avoids "invalid-api-key" errors during Next.js prerendering/build
  app = {} as FirebaseApp
  db = {} as Firestore
  auth = {} as Auth
}

export { app, db, auth }
export default app
