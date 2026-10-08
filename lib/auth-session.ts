"use client"

import { useEffect, useState } from "react"
import { signInWithEmailAndPassword, signOut, onAuthStateChanged, type User } from "firebase/auth"
import { doc, getDoc } from "firebase/firestore"
import { auth, db } from "@/lib/firebase"
import { col } from "@/lib/account-mode"
import { accessTag, clearAllStoredAccess, readStoredAccess } from "@/lib/access-codes"
import {
  accountTagFromEmail,
  loginEmailFromUsername,
} from "@/lib/scan-employees"
import {
  DEFAULT_SCANNER_PERMISSIONS,
  normalizePermissionIds,
  pathAllowedByPermissions,
  type AppPermissionId,
} from "@/lib/app-permissions"

export type UserRole = "admin" | "employee" | "scanner" | "staff"

export type SessionUser = {
  email: string
  role: UserRole
  name: string
  /** Field staff id stamped on edits (e.g. EMP01). */
  accountTag?: string
  permissions?: AppPermissionId[]
  disabled?: boolean
  /** Shared login: each person must enter a personal 6-digit access code after login. */
  requiresAccessCode?: boolean
  /** Person who entered the access code on this device. */
  accessName?: string
  accessCode?: string
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
  return v === "admin" || v === "employee" || v === "scanner" || v === "staff"
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

export function isRestrictedStaff(user: SessionUser): boolean {
  return user.role === "scanner" || user.role === "staff"
}

export function effectivePermissions(user: SessionUser): AppPermissionId[] {
  if (user.role === "admin") return normalizePermissionIds(user.permissions)
  if (user.permissions?.length) return user.permissions
  if (user.role === "scanner" || user.role === "staff") return [...DEFAULT_SCANNER_PERMISSIONS]
  return []
}

async function resolveRole(user: User): Promise<{
  role: UserRole
  accountTag?: string
  permissions?: AppPermissionId[]
  disabled?: boolean
  requiresAccessCode?: boolean
}> {
  let accountTag = accountTagFromEmail(user.email || "")
  try {
    const roleDoc = await Promise.race([
      getDoc(doc(db, col("users"), user.uid)),
      new Promise<never>((_, reject) => {
        window.setTimeout(() => reject(new Error("role lookup timeout")), 8000)
      }),
    ])
    const data = roleDoc.data()
    const roleRaw = data?.role
    if (typeof data?.accountTag === "string" && data.accountTag.trim()) {
      accountTag = data.accountTag.trim().toUpperCase()
    }
    const permissions = normalizePermissionIds(data?.permissions)
    const disabled = data?.disabled === true
    const requiresAccessCode = data?.requiresAccessCode === true
    if (isUserRole(roleRaw)) {
      return { role: roleRaw, accountTag, permissions, disabled, requiresAccessCode }
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

async function mapFirebaseUser(user: User): Promise<SessionUser | null> {
  const { role, accountTag, permissions, disabled, requiresAccessCode } = await resolveRole(user)
  if (disabled) return null
  const base: SessionUser = {
    email: user.email || "",
    role,
    name: toDisplayName(user, accountTag),
    accountTag,
    permissions: permissions?.length ? permissions : undefined,
    disabled: false,
  }
  if (!requiresAccessCode || role === "admin") return base
  const access = readStoredAccess(base.email)
  if (!access) return { ...base, requiresAccessCode: true }
  return {
    ...base,
    requiresAccessCode: true,
    accessName: access.name,
    accessCode: access.code,
    accountTag: accessTag(access),
    name: access.name,
  }
}

export async function loginWithFirebase(emailOrUsername: string, password: string): Promise<SessionUser> {
  const email = loginEmailFromUsername(emailOrUsername)
  const credential = await signInWithEmailAndPassword(auth, email, password)
  const mapped = await mapFirebaseUser(credential.user)
  if (!mapped) {
    await signOut(auth)
    throw new Error("This account has been disabled. Contact admin.")
  }
  writeCachedSessionUser(mapped)
  return mapped
}

export async function logoutFirebase(): Promise<void> {
  writeCachedSessionUser(null)
  clearAllStoredAccess()
  await signOut(auth)
}

const EMPLOYEE_BLOCKED_PREFIXES = ["/reports"] as const

export function defaultHomePath(user: SessionUser): string {
  if (user.role === "admin" || user.role === "employee") return "/"
  const perms = effectivePermissions(user)
  if (perms.includes("scan-edit")) return "/scan-edit"
  if (perms.includes("open-draft-entries")) return "/open-draft-entries"
  if (perms.includes("draft-entries")) return "/draft-entries"
  if (perms.includes("draft-catalog")) return "/inventory/draft-catalog"
  if (perms.includes("inventory")) return "/inventory"
  return "/scan-edit"
}

export function canAccessPath(user: SessionUser, pathname: string): boolean {
  const path = pathname || "/"
  if (path.startsWith("/settings")) return user.role === "admin"
  if (user.role === "admin") return true
  if (user.role === "employee") {
    return !EMPLOYEE_BLOCKED_PREFIXES.some(
      (blocked) => path === blocked || path.startsWith(`${blocked}/`)
    )
  }
  if (isRestrictedStaff(user)) {
    if (path === "/") return false
    return pathAllowedByPermissions(path, effectivePermissions(user))
  }
  return false
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
      if (!mapped) {
        writeCachedSessionUser(null)
        setUser(null)
        setReady(true)
        return
      }
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
