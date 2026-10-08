import { NextResponse } from "next/server"
import { adminAuth, adminDb } from "@/lib/server/firebase-admin"
import { verifyAdminFromRequest } from "@/lib/server/verify-admin-request"
import { loginEmailFromUsername } from "@/lib/scan-employees"
import { normalizePermissionIds, type AppPermissionId } from "@/lib/app-permissions"
import type { ManagedAccountRecord } from "@/lib/managed-account-types"

export const runtime = "nodejs"

function usernameValid(username: string): boolean {
  return /^[a-zA-Z0-9._-]{2,32}$/.test(username)
}

function mapUserDoc(
  uid: string,
  data: Record<string, unknown> | undefined,
  email: string
): ManagedAccountRecord {
  return {
    uid,
    username: String(data?.username ?? data?.displayName ?? uid.slice(0, 8)),
    accountTag: String(data?.accountTag ?? "").toUpperCase(),
    email: String(data?.email ?? email),
    role: (data?.role as ManagedAccountRecord["role"]) ?? "staff",
    permissions: normalizePermissionIds(data?.permissions),
    disabled: data?.disabled === true,
    requiresAccessCode: data?.requiresAccessCode === true,
    createdAt: (() => {
      const t = data?.createdAt as { toDate?: () => Date } | undefined
      return t?.toDate?.()?.toISOString?.() ?? undefined
    })(),
    updatedAt: (() => {
      const t = data?.updatedAt as { toDate?: () => Date } | undefined
      return t?.toDate?.()?.toISOString?.() ?? undefined
    })(),
  }
}

export async function GET(request: Request) {
  const admin = await verifyAdminFromRequest(request)
  if ("error" in admin) {
    return NextResponse.json({ error: admin.error }, { status: admin.status })
  }

  try {
    const list = await adminAuth().listUsers(1000)
    const rows: ManagedAccountRecord[] = []
    for (const user of list.users) {
      const snap = await adminDb().collection("users").doc(user.uid).get()
      rows.push(mapUserDoc(user.uid, snap.data(), user.email || ""))
    }
    rows.sort((a, b) => {
      if (a.role === "admin" && b.role !== "admin") return -1
      if (b.role === "admin" && a.role !== "admin") return 1
      return a.accountTag.localeCompare(b.accountTag)
    })
    return NextResponse.json({ accounts: rows })
  } catch (e) {
    console.error(e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to list accounts" },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  const admin = await verifyAdminFromRequest(request)
  if ("error" in admin) {
    return NextResponse.json({ error: admin.error }, { status: admin.status })
  }

  let body: { username?: string; password?: string; permissions?: AppPermissionId[] }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const username = String(body.username ?? "").trim()
  const password = String(body.password ?? "")
  const permissions = normalizePermissionIds(body.permissions)

  if (!usernameValid(username)) {
    return NextResponse.json(
      { error: "Username must be 2–32 characters (letters, numbers, . _ -)" },
      { status: 400 }
    )
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 })
  }
  if (permissions.length === 0) {
    return NextResponse.json({ error: "Select at least one feature permission" }, { status: 400 })
  }

  const email = loginEmailFromUsername(username)
  const accountTag = username.toUpperCase()

  try {
    const created = await adminAuth().createUser({
      email,
      password,
      displayName: accountTag,
    })

    const now = new Date()
    await adminDb()
      .collection("users")
      .doc(created.uid)
      .set({
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

    return NextResponse.json({
      account: mapUserDoc(created.uid, {
        role: "staff",
        username,
        accountTag,
        email,
        permissions,
        createdAt: now,
        updatedAt: now,
      }, email),
    })
  } catch (e) {
    console.error(e)
    const msg = e instanceof Error ? e.message : "Failed to create account"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
