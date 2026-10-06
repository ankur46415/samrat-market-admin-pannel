/**
 * Create field-staff Firebase Auth users (EMP01, EMP02) and Firestore role docs.
 *
 * Requires Email/Password sign-up enabled in Firebase Console (or run once as admin via Console).
 *
 * Usage:
 *   node scripts/seed-scan-employees.mjs
 *
 * Uses NEXT_PUBLIC_FIREBASE_* from .env.local (same as the web app).
 */
import { readFileSync, existsSync } from "node:fs"
import { resolve } from "node:path"
import { initializeApp } from "firebase/app"
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth"
import { getFirestore, doc, setDoc } from "firebase/firestore"

const SCAN_EMPLOYEE_EMAIL_DOMAIN = "@employees.samrat.local"

function loginEmailFromUsername(input) {
  const trimmed = input.trim()
  if (!trimmed) return trimmed
  if (trimmed.includes("@")) return trimmed.toLowerCase()
  return `${trimmed.toLowerCase()}${SCAN_EMPLOYEE_EMAIL_DOMAIN}`
}

function loadEnvLocal() {
  const envPath = resolve(process.cwd(), ".env.local")
  if (!existsSync(envPath)) return
  const text = readFileSync(envPath, "utf8")
  for (const line of text.split("\n")) {
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/)
    if (!m) continue
    const key = m[1]
    let val = m[2].trim()
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1)
    }
    if (!process.env[key]) process.env[key] = val
  }
}

loadEnvLocal()

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
}

/** One-time passwords — change after first login if you prefer. */
const STAFF = [
  { username: "EMP01", password: "Sx9#kLm2pQv7@wNz5" },
  { username: "EMP02", password: "Rf4&bYt8hJc3!mXq6" },
]

async function ensureUser(auth, db, { username, password }) {
  const email = loginEmailFromUsername(username)
  let uid
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password)
    uid = cred.user.uid
    console.log(`Created Auth user ${username} (${email})`)
  } catch (err) {
    if (err?.code === "auth/email-already-in-use") {
      const cred = await signInWithEmailAndPassword(auth, email, password)
      uid = cred.user.uid
      console.log(`Auth user ${username} already exists — signed in to update profile doc`)
    } else {
      throw err
    }
  }

  await setDoc(
    doc(db, "users", uid),
    {
      role: "staff",
      accountTag: username.toUpperCase(),
      username,
      email,
      displayName: username.toUpperCase(),
      permissions: ["scan-edit", "open-draft-entries"],
    },
    { merge: true }
  )
  console.log(`Firestore users/${uid} → role staff, accountTag ${username.toUpperCase()}`)
  await signOut(auth)
}

async function main() {
  if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
    console.error("Missing Firebase config in .env.local")
    process.exit(1)
  }
  const app = initializeApp(firebaseConfig)
  const auth = getAuth(app)
  const db = getFirestore(app)

  for (const account of STAFF) {
    await ensureUser(auth, db, account)
  }

  console.log("\nDone. Login with username EMP01 / EMP02 and the passwords above.")
  console.log("(Do not commit passwords — rotate in Firebase if this file is shared.)")
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
