"use client"

import { collection, doc, getDoc, getDocs, query, setDoc, Timestamp, where } from "firebase/firestore"
import { db } from "@/lib/firebase"

/** Shared logins (e.g. one delivery login used by several people) ask for a personal 6-digit code. */
const COLLECTION = "access_codes"
const STORAGE_PREFIX = "samrat_access_code_"

export type AccessCode = {
  code: string
  name: string
  accountEmail: string
  active: boolean
  createdAt?: string
}

export type StoredAccess = {
  code: string
  name: string
}

function storageKey(email: string) {
  return `${STORAGE_PREFIX}${email.trim().toLowerCase()}`
}

export function readStoredAccess(email: string): StoredAccess | null {
  if (typeof window === "undefined" || !email) return null
  try {
    const raw = localStorage.getItem(storageKey(email))
    if (!raw) return null
    const parsed = JSON.parse(raw) as StoredAccess
    return /^\d{6}$/.test(parsed?.code ?? "") && parsed.name ? parsed : null
  } catch {
    return null
  }
}

export function writeStoredAccess(email: string, access: StoredAccess | null) {
  if (typeof window === "undefined" || !email) return
  if (access) localStorage.setItem(storageKey(email), JSON.stringify(access))
  else localStorage.removeItem(storageKey(email))
}

export function clearAllStoredAccess() {
  if (typeof window === "undefined") return
  for (let i = localStorage.length - 1; i >= 0; i -= 1) {
    const key = localStorage.key(i)
    if (key?.startsWith(STORAGE_PREFIX)) localStorage.removeItem(key)
  }
}

/** Tag stamped on every edit, e.g. ATUL-482913. */
export function accessTag(access: StoredAccess) {
  return `${access.name.trim().toUpperCase().replace(/\s+/g, "_")}-${access.code}`
}

function isWeakCode(code: string) {
  if (new Set(code).size < 4) return true
  for (let i = 0; i + 2 < code.length; i += 1) {
    const a = Number(code[i])
    const b = Number(code[i + 1])
    const c = Number(code[i + 2])
    if (b - a === c - b && Math.abs(b - a) <= 1) return true
  }
  return false
}

function randomCode() {
  const buf = new Uint32Array(1)
  for (;;) {
    crypto.getRandomValues(buf)
    const code = String(100000 + (buf[0] % 900000))
    if (!isWeakCode(code)) return code
  }
}

export async function listAccessCodes(): Promise<AccessCode[]> {
  const snap = await getDocs(collection(db, COLLECTION))
  return snap.docs
    .map((entry) => {
      const data = entry.data() as Record<string, unknown>
      const created = data.createdAt as { toDate?: () => Date } | undefined
      return {
        code: entry.id,
        name: String(data.name ?? ""),
        accountEmail: String(data.accountEmail ?? ""),
        active: data.active !== false,
        createdAt: created?.toDate?.()?.toISOString(),
      }
    })
    .sort((a, b) => a.name.localeCompare(b.name))
}

export async function createAccessCode(name: string, accountEmail: string): Promise<AccessCode> {
  const cleanName = name.trim()
  const email = accountEmail.trim().toLowerCase()
  if (!cleanName) throw new Error("Enter the person's name.")
  if (!email) throw new Error("Choose the login this code is for.")
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const code = randomCode()
    const ref = doc(db, COLLECTION, code)
    if ((await getDoc(ref)).exists()) continue
    const now = Timestamp.now()
    await setDoc(ref, { name: cleanName, accountEmail: email, active: true, createdAt: now, updatedAt: now })
    return { code, name: cleanName, accountEmail: email, active: true, createdAt: now.toDate().toISOString() }
  }
  throw new Error("Could not find a free code. Try again.")
}

export async function setAccessCodeActive(code: string, active: boolean) {
  await setDoc(doc(db, COLLECTION, code), { active, updatedAt: Timestamp.now() }, { merge: true })
}

/** True when at least one active code exists for this login, so it must ask for a code. */
export async function loginHasAccessCodes(accountEmail: string): Promise<boolean> {
  const email = accountEmail.trim().toLowerCase()
  if (!email) return false
  const snap = await getDocs(query(collection(db, COLLECTION), where("accountEmail", "==", email)))
  return snap.docs.some((entry) => entry.data().active !== false)
}

/** Returns the person for this code if it is active and belongs to this login. */
export async function verifyAccessCode(code: string, accountEmail: string): Promise<StoredAccess | null> {
  if (!/^\d{6}$/.test(code)) return null
  const snap = await getDoc(doc(db, COLLECTION, code))
  if (!snap.exists()) return null
  const data = snap.data() as Record<string, unknown>
  if (data.active === false) return null
  if (String(data.accountEmail ?? "").toLowerCase() !== accountEmail.trim().toLowerCase()) return null
  return { code, name: String(data.name ?? "") }
}
