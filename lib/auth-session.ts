"use client"

import { useEffect, useState } from "react"
import { signInWithEmailAndPassword, signOut, onAuthStateChanged, type User } from "firebase/auth"
import { doc, getDoc } from "firebase/firestore"
import { auth, db } from "@/lib/firebase"

export type UserRole = "admin" | "employee"

export type SessionUser = {
  email: string
  role: UserRole
  name: string
}

function normalizeEmail(v: string): string {
  return v.trim().toLowerCase()
}

function fallbackRoleByEmail(email: string): UserRole {
  const e = normalizeEmail(email)
  if (e === "samratadmin@gmail.com") return "admin"
  return "employee"
}

const SESSION_CACHE_KEY = "samrat_session_user_v1"

function readCachedSessionUser(): SessionUser | null {
  if (typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem(SESSION_CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as SessionUser
    if (!parsed?.email || (parsed.role !== "admin" && parsed.role !== "employee")) return null
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

async function resolveRole(user: User): Promise<UserRole> {
  try {
    const roleDoc = await Promise.race([
      getDoc(doc(db, "users", user.uid)),
      new Promise<never>((_, reject) => {
        window.setTimeout(() => reject(new Error("role lookup timeout")), 1500)
      }),
    ])
    const roleRaw = roleDoc.data()?.role
    if (roleRaw === "admin" || roleRaw === "employee") return roleRaw
  } catch {
    // Fall back to email mapping when role doc is missing/unavailable/offline.
  }
  return fallbackRoleByEmail(user.email || "")
}

function toDisplayName(user: User): string {
  if (user.displayName?.trim()) return user.displayName.trim()
  const email = normalizeEmail(user.email || "")
  if (email === "samratadmin@gmail.com") return "Samrat Admin"
  return "Samrat Employee"
}

async function mapFirebaseUser(user: User): Promise<SessionUser> {
  return {
    email: user.email || "",
    role: await resolveRole(user),
    name: toDisplayName(user),
  }
}

export async function loginWithFirebase(email: string, password: string): Promise<SessionUser> {
  const credential = await signInWithEmailAndPassword(auth, email.trim(), password)
  const mapped = await mapFirebaseUser(credential.user)
  writeCachedSessionUser(mapped)
  return mapped
}

export async function logoutFirebase(): Promise<void> {
  writeCachedSessionUser(null)
  await signOut(auth)
}

// Employee restrictions.
const EMPLOYEE_BLOCKED_PREFIXES = ["/reports"] as const

export function canAccessPath(role: UserRole, pathname: string): boolean {
  if (role === "admin") return true
  const path = pathname || "/"
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

