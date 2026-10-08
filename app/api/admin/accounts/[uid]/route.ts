import { NextResponse } from "next/server"
import { adminAuth, adminDb } from "@/lib/server/firebase-admin"
import { verifyAdminFromRequest } from "@/lib/server/verify-admin-request"
import { normalizePermissionIds, type AppPermissionId } from "@/lib/app-permissions"

export const runtime = "nodejs"

type RouteContext = { params: Promise<{ uid: string }> }

export async function PATCH(request: Request, context: RouteContext) {
  const admin = await verifyAdminFromRequest(request)
  if ("error" in admin) {
    return NextResponse.json({ error: admin.error }, { status: admin.status })
  }

  const { uid } = await context.params
  if (!uid) {
    return NextResponse.json({ error: "Missing uid" }, { status: 400 })
  }

  let body: {
    permissions?: AppPermissionId[]
    password?: string
    disabled?: boolean
    requiresAccessCode?: boolean
  }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const userSnap = await adminDb().collection("users").doc(uid).get()
  const role = userSnap.data()?.role
  if (role === "admin") {
    return NextResponse.json({ error: "Cannot modify main admin account here" }, { status: 400 })
  }

  try {
    if (body.password != null && String(body.password).length >= 8) {
      await adminAuth().updateUser(uid, { password: String(body.password) })
    }

    const patch: Record<string, unknown> = { updatedAt: new Date() }
    if (body.permissions != null) {
      const permissions = normalizePermissionIds(body.permissions)
      if (permissions.length === 0) {
        return NextResponse.json({ error: "At least one permission is required" }, { status: 400 })
      }
      patch.permissions = permissions
    }
    if (typeof body.requiresAccessCode === "boolean") {
      patch.requiresAccessCode = body.requiresAccessCode
    }
    if (typeof body.disabled === "boolean") {
      patch.disabled = body.disabled
      await adminAuth().updateUser(uid, { disabled: body.disabled })
    }

    await adminDb().collection("users").doc(uid).set(patch, { merge: true })

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error(e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Update failed" },
      { status: 500 }
    )
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const admin = await verifyAdminFromRequest(request)
  if ("error" in admin) {
    return NextResponse.json({ error: admin.error }, { status: admin.status })
  }

  const { uid } = await context.params
  if (uid === admin.uid) {
    return NextResponse.json({ error: "Cannot delete your own account" }, { status: 400 })
  }

  const userSnap = await adminDb().collection("users").doc(uid).get()
  if (userSnap.data()?.role === "admin") {
    return NextResponse.json({ error: "Cannot delete admin account" }, { status: 400 })
  }

  try {
    await adminAuth().updateUser(uid, { disabled: true })
    await adminDb().collection("users").doc(uid).set({ disabled: true, updatedAt: new Date() }, { merge: true })
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error(e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Delete failed" },
      { status: 500 }
    )
  }
}
