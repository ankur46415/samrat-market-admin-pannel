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

  let auth: ReturnType<typeof adminAuth>
  try {
    auth = adminAuth()
  } catch (e) {
    const message = e instanceof Error ? e.message : "Firebase admin is not configured."
    return {
      error: message.includes("FIREBASE_SERVICE_ACCOUNT_JSON")
        ? message
        : `FIREBASE_SERVICE_ACCOUNT_JSON could not be read: ${message}`,
      status: 503,
    }
  }

  let uid: string
  let email: string
  try {
    const decoded = await auth.verifyIdToken(token)
    uid = decoded.uid
    email = decoded.email || ""
  } catch (e) {
    const code = (e as { code?: string })?.code || ""
    if (code === "auth/id-token-expired") {
      return { error: "Your login expired. Log out and log in again.", status: 401 }
    }
    if (code === "auth/argument-error" || code === "auth/invalid-id-token") {
      return {
        error:
          "The login token does not match this server's Firebase project. Check that FIREBASE_SERVICE_ACCOUNT_JSON is for samrat-supermarket.",
        status: 401,
      }
    }
    return { error: e instanceof Error ? e.message : "Could not check the login token.", status: 401 }
  }

  try {
    const snap = await adminDb().collection("users").doc(uid).get()
    const role = snap.data()?.role
    const isAdmin = role === "admin" || email.toLowerCase() === "samratadmin@gmail.com"
    if (!isAdmin) {
      return { error: "Admin access required", status: 403 }
    }
    return { uid, email }
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not read the users list.", status: 500 }
  }
}
