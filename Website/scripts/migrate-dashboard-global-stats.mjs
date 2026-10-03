/**
 * One-time migration: seed dashboard_stats/global from all sales documents.
 *
 * Prerequisites:
 *   - Firebase web rules allow authenticated admin write to dashboard_stats/global
 *   - Run while logged in is NOT supported here; use service account or temporarily allow write
 *
 * Usage (with env vars from .env.local):
 *   node scripts/migrate-dashboard-global-stats.mjs
 *   node scripts/migrate-dashboard-global-stats.mjs --force
 *
 * Reads entire sales collection once (same as old dashboard revenue logic).
 */
import { readFileSync, existsSync } from "node:fs"
import { resolve } from "node:path"
import { initializeApp } from "firebase/app"
import {
  getFirestore,
  collection,
  getDocs,
  doc,
  getDoc,
  setDoc,
  Timestamp,
} from "firebase/firestore"

function loadEnvLocal() {
  const envPath = resolve(process.cwd(), ".env.local")
  if (!existsSync(envPath)) return
  const text = readFileSync(envPath, "utf8")
  for (const line of text.split("\n")) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const eq = trimmed.indexOf("=")
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "")
    if (!process.env[key]) process.env[key] = val
  }
}

loadEnvLocal()

const force = process.argv.includes("--force")

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
}

const app = initializeApp(firebaseConfig)
const db = getFirestore(app)

function saleTotal(data) {
  if (Array.isArray(data.items) && data.items.length > 0) {
    return Number(data.total ?? 0)
  }
  const qty = Number(data.quantity ?? 1)
  const price = Number(data.pricePerUnit ?? data.price ?? 0)
  return Number(data.totalAmount ?? data.total ?? qty * price)
}

async function main() {
  const statsRef = doc(db, "dashboard_stats", "global")
  const existing = await getDoc(statsRef)

  if (existing.exists() && !force) {
    console.log("dashboard_stats/global already exists. Use --force to overwrite.")
    console.log(existing.data())
    process.exit(0)
  }

  console.log("Reading all sales documents…")
  const salesSnap = await getDocs(collection(db, "sales"))
  let totalRevenue = 0
  for (const d of salesSnap.docs) {
    totalRevenue += saleTotal(d.data())
  }
  const totalSales = salesSnap.size

  await setDoc(statsRef, {
    totalRevenue,
    totalSales,
    updatedAt: Timestamp.now(),
    migratedAt: Timestamp.now(),
    migrationSource: "scripts/migrate-dashboard-global-stats.mjs",
  })

  console.log("Done.")
  console.log({ totalRevenue, totalSales, documentsRead: salesSnap.size })
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
