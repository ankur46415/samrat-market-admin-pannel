import { adminAuth, adminDb } from "@/lib/server/firebase-admin"

export type VerifiedAdmin = {
  uid: string
  email: string
}

export async function verifyAdminFromRequest(
  request: Request
): Promise<VerifiedAdmin | { error: string; status: number }> {
  const authHeader = request.headers.get("authorization") || ""
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : ""
  if (!token) {
    return { error: "Missing authorization token", status: 401 }
  }

  try {
    const decoded = await adminAuth().verifyIdToken(token)
    const uid = decoded.uid
    const email = decoded.email || ""
    const snap = await adminDb().collection("users").doc(uid).get()
    const role = snap.data()?.role
    const isAdmin =
      role === "admin" ||
      email.toLowerCase() === "samratadmin@gmail.com"
    if (!isAdmin) {
      return { error: "Admin access required", status: 403 }
    }
    return { uid, email }
  } catch {
    return { error: "Invalid or expired token", status: 401 }
  }
}
