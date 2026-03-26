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

async function resolveRole(user: User): Promise<UserRole> {
  try {
    // Optional role source for future scaling.
    const roleDoc = await getDoc(doc(db, "users", user.uid))
    const roleRaw = roleDoc.data()?.role
    if (roleRaw === "admin" || roleRaw === "employee") return roleRaw
  } catch {
    // Fall back to email mapping when role doc is missing/unavailable.
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
  return mapFirebaseUser(credential.user)
}

export async function logoutFirebase(): Promise<void> {
  await signOut(auth)
}

// Employee restrictions.
const EMPLOYEE_BLOCKED_PREFIXES = ["/reports", "/sales/today"] as const

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
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        setUser(null)
        setReady(true)
        return
      }
      const mapped = await mapFirebaseUser(firebaseUser)
      setUser(mapped)
      setReady(true)
    })
    return () => unsub()
  }, [])

  return { user, ready }
}

