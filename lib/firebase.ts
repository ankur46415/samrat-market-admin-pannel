import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app"
import { getFirestore, Firestore } from "firebase/firestore"
import { getAuth, Auth } from "firebase/auth"

// Using fallbacks so it works even if Vercel env variables are missing
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyAKL6zX6sybsSlGL1Wzvg9tPRYg2A1kAKc",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "samrat-supermarket.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "samrat-supermarket",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "samrat-supermarket.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "131061026282",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:131061026282:web:1a1851136fc5e8a6a5f693",
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || "G-TMGS7ZS5NX"
}

// Initialize Firebase
let app: FirebaseApp
let db: Firestore
let auth: Auth

if (typeof window !== "undefined") {
  // Client side initialization
  try {
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp()
    db = getFirestore(app)
    auth = getAuth(app)
  } catch (error) {
    console.error("Error initializing Firebase:", error)
    app = {} as FirebaseApp
    db = {} as Firestore
    auth = {} as Auth
  }
} else {
  // Server side placeholders to prevent Next.js from throwing prerender errors
  app = {} as FirebaseApp
  db = {} as Firestore
  auth = {} as Auth
}

export { app, db, auth }
export default app
