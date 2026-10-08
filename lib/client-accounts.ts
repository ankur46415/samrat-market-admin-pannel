"use client"

import { deleteApp, initializeApp } from "firebase/app"
import { createUserWithEmailAndPassword, getAuth, signOut } from "firebase/auth"
import { collection, doc, getDocs, setDoc, Timestamp } from "firebase/firestore"
import app, { db } from "@/lib/firebase"
import { loginEmailFromUsername } from "@/lib/scan-employees"
import { normalizePermissionIds, type AppPermissionId } from "@/lib/app-permissions"
import type { CreateManagedAccountInput, ManagedAccountRecord } from "@/lib/managed-account-types"

/**
 * Account management without the Firebase Admin SDK. Used when the server has no
 * FIREBASE_SERVICE_ACCOUNT_JSON. Logins are created with a separate Firebase app
 * instance so the signed-in admin is not replaced. Password resets are not possible here.
 */

function iso(value: unknown): string | undefined {
  const t = value as { toDate?: () => Date } | undefined
  return t?.toDate?.()?.toISOString?.() ?? undefined
}

export async function listAccountsClient(): Promise<ManagedAccountRecord[]> {
  const snap = await getDocs(collection(db, "users"))
  const rows: ManagedAccountRecord[] = snap.docs.map((entry) => {
    const data = entry.data() as Record<string, unknown>
    return {
      uid: entry.id,
      username: String(data.username ?? data.displayName ?? entry.id.slice(0, 8)),
      accountTag: String(data.accountTag ?? "").toUpperCase(),
      email: String(data.email ?? ""),
      role: (data.role as ManagedAccountRecord["role"]) ?? "staff",
      permissions: normalizePermissionIds(data.permissions),
      disabled: data.disabled === true,
      requiresAccessCode: data.requiresAccessCode === true,
      createdAt: iso(data.createdAt),
      updatedAt: iso(data.updatedAt),
    }
  })
  rows.sort((a, b) => {
    if (a.role === "admin" && b.role !== "admin") return -1
    if (b.role === "admin" && a.role !== "admin") return 1
    return a.accountTag.localeCompare(b.accountTag)
  })
  return rows
}

export async function createAccountClient(input: CreateManagedAccountInput): Promise<ManagedAccountRecord> {
  const username = input.username.trim()
  if (!/^[a-zA-Z0-9._-]{2,32}$/.test(username)) {
    throw new Error("Username must be 2–32 characters (letters, numbers, . _ -)")
  }
  if (input.password.length < 8) throw new Error("Password must be at least 8 characters")
  const permissions = normalizePermissionIds(input.permissions)
  if (permissions.length === 0) throw new Error("Select at least one feature permission")

  const email = loginEmailFromUsername(username)
  const accountTag = username.toUpperCase()
  const helper = initializeApp(app.options, `account-create-${Date.now()}`)
  let uid: string
  try {
    const helperAuth = getAuth(helper)
    try {
      const created = await createUserWithEmailAndPassword(helperAuth, email, input.password)
      uid = created.user.uid
    } catch (e) {
      const code = (e as { code?: string })?.code
      if (code === "auth/email-already-in-use") {
        throw new Error(`${accountTag} already exists. Choose a different username.`)
      }
      if (code === "auth/weak-password") throw new Error("That password is too weak.")
      throw e
    }
    await signOut(helperAuth)
  } finally {
    await deleteApp(helper).catch(() => undefined)
  }

  const now = Timestamp.now()
  await setDoc(doc(db, "users", uid), {
    role: "staff",
    username,
    accountTag,
    email,
    displayName: accountTag,
    permissions,
    disabled: false,
    createdAt: now,
    updatedAt: now,
  })

  return {
    uid,
    username,
    accountTag,
    email,
    role: "staff",
    permissions,
    disabled: false,
    createdAt: now.toDate().toISOString(),
    updatedAt: now.toDate().toISOString(),
  }
}

export async function updateAccountClient(
  uid: string,
  patch: { permissions?: AppPermissionId[]; password?: string; disabled?: boolean; requiresAccessCode?: boolean }
): Promise<void> {
  if (patch.password != null) {
    throw new Error(
      "Changing a password needs FIREBASE_SERVICE_ACCOUNT_JSON on the server. Disable this login and create a new one instead."
    )
  }
  const next: Record<string, unknown> = { updatedAt: Timestamp.now() }
  if (patch.permissions != null) {
    const permissions = normalizePermissionIds(patch.permissions)
    if (permissions.length === 0) throw new Error("At least one permission is required")
    next.permissions = permissions
  }
  if (typeof patch.disabled === "boolean") next.disabled = patch.disabled
  if (typeof patch.requiresAccessCode === "boolean") next.requiresAccessCode = patch.requiresAccessCode
  await setDoc(doc(db, "users", uid), next, { merge: true })
}
