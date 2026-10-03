"use client"

import { useEffect, useState } from "react"
import { signInWithEmailAndPassword, signOut, onAuthStateChanged, type User } from "firebase/auth"
import { doc, getDoc } from "firebase/firestore"
import { auth, db } from "@/lib/firebase"
import { col } from "@/lib/account-mode"
import {
  accountTagFromEmail,
  loginEmailFromUsername,
  SCANNER_ALLOWED_PREFIXES,
} from "@/lib/scan-employees"

export type UserRole = "admin" | "employee" | "scanner"

export type SessionUser = {
  email: string
  role: UserRole
  name: string
  /** Field staff id stamped on product tag (e.g. EMP01). */
  accountTag?: string
}

function normalizeEmail(v: string): string {
  return v.trim().toLowerCase()
}

function fallbackRoleByEmail(email: string): UserRole {
  const e = normalizeEmail(email)
  if (e === "samratadmin@gmail.com") return "admin"
  if (accountTagFromEmail(e)) return "scanner"
  return "employee"
}

const SESSION_CACHE_KEY = "samrat_session_user_v1"

function isUserRole(v: unknown): v is UserRole {
  return v === "admin" || v === "employee" || v === "scanner"
}

function readCachedSessionUser(): SessionUser | null {
  if (typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem(SESSION_CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as SessionUser
    if (!parsed?.email || !isUserRole(parsed.role)) return null
    return parsed
  } catch {
    return null
  }
}

function writeCachedSessionUser(user: SessionUser | null): void {
  if (typeof window === "undefined") return
  if (!user) {
    localStorage.removeItem(SESSION_CACHE_KEY)
    return
  }
  localStorage.setItem(SESSION_CACHE_KEY, JSON.stringify(user))
}

async function resolveRole(user: User): Promise<{ role: UserRole; accountTag?: string }> {
  let accountTag = accountTagFromEmail(user.email || "")
  try {
    const roleDoc = await Promise.race([
      getDoc(doc(db, col("users"), user.uid)),
      new Promise<never>((_, reject) => {
        window.setTimeout(() => reject(new Error("role lookup timeout")), 1500)
      }),
    ])
    const data = roleDoc.data()
    const roleRaw = data?.role
    if (typeof data?.accountTag === "string" && data.accountTag.trim()) {
      accountTag = data.accountTag.trim().toUpperCase()
    }
    if (isUserRole(roleRaw)) {
      return { role: roleRaw, accountTag }
    }
  } catch {
    // Fall back to email mapping when role doc is missing/unavailable/offline.
  }
  return { role: fallbackRoleByEmail(user.email || ""), accountTag }
}

function toDisplayName(user: User, accountTag?: string): string {
  if (accountTag) return accountTag
  if (user.displayName?.trim()) return user.displayName.trim()
  const email = normalizeEmail(user.email || "")
  if (email === "samratadmin@gmail.com") return "Samrat Admin"
  return "Samrat Employee"
}

async function mapFirebaseUser(user: User): Promise<SessionUser> {
  const { role, accountTag } = await resolveRole(user)
  return {
    email: user.email || "",
    role,
    name: toDisplayName(user, accountTag),
    accountTag,
  }
}

export async function loginWithFirebase(emailOrUsername: string, password: string): Promise<SessionUser> {
  const email = loginEmailFromUsername(emailOrUsername)
  const credential = await signInWithEmailAndPassword(auth, email, password)
  const mapped = await mapFirebaseUser(credential.user)
  writeCachedSessionUser(mapped)
  return mapped
}

export async function logoutFirebase(): Promise<void> {
  writeCachedSessionUser(null)
  await signOut(auth)
}

const EMPLOYEE_BLOCKED_PREFIXES = ["/reports"] as const

function pathAllowedForScanner(pathname: string): boolean {
  const path = pathname || "/"
  return SCANNER_ALLOWED_PREFIXES.some(
    (allowed) => path === allowed || path.startsWith(`${allowed}/`)
  )
}

export function defaultHomePath(role: UserRole): string {
  if (role === "scanner") return "/scan-edit"
  return "/"
}

export function canAccessPath(role: UserRole, pathname: string): boolean {
  const path = pathname || "/"
  if (role === "admin") return true
  if (role === "scanner") return pathAllowedForScanner(path)
  return !EMPLOYEE_BLOCKED_PREFIXES.some(
    (blocked) => path === blocked || path.startsWith(`${blocked}/`)
  )
}

export function useSessionUser() {
  const [user, setUser] = useState<SessionUser | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let settled = false
    const cached = readCachedSessionUser()

    const timeout = window.setTimeout(() => {
      if (settled) return
      if (cached) {
        setUser(cached)
        setReady(true)
      }
    }, 2000)

    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        if (!navigator.onLine && cached) {
          settled = true
          window.clearTimeout(timeout)
          setUser(cached)
          setReady(true)
          return
        }
        settled = true
        window.clearTimeout(timeout)
        writeCachedSessionUser(null)
        setUser(null)
        setReady(true)
        return
      }
      const mapped = await mapFirebaseUser(firebaseUser)
      settled = true
      window.clearTimeout(timeout)
      writeCachedSessionUser(mapped)
      setUser(mapped)
      setReady(true)
    })
    return () => {
      window.clearTimeout(timeout)
      unsub()
    }
  }, [])

  return { user, ready }
}
