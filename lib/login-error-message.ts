/** User-facing login errors from Firebase Auth (client). */
export function loginErrorMessage(err: unknown): string {
  const code =
    typeof err === "object" && err && "code" in err
      ? String((err as { code?: string }).code)
      : ""

  if (err instanceof Error && err.message.includes("disabled")) {
    return err.message
  }

  switch (code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "Invalid email/username or password."
    case "auth/invalid-email":
      return "Invalid email format. Staff can log in with username only (e.g. EMP01)."
    case "auth/too-many-requests":
      return "Too many attempts. Wait a few minutes and try again."
    case "auth/network-request-failed":
      return "Network error. Check internet connection and try again."
    case "auth/unauthorized-domain":
      return "This website URL is not allowed in Firebase. In Firebase Console → Authentication → Settings → Authorized domains, add your Vercel URL (e.g. your-app.vercel.app)."
    default:
      break
  }

  if (err instanceof Error && err.message.trim()) {
    return err.message
  }
  return "Login failed. Please try again."
}
