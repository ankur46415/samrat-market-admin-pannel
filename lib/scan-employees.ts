/** Internal email domain for field staff (Firebase Auth requires an email). */
export const SCAN_EMPLOYEE_EMAIL_DOMAIN = "@employees.samrat.local"

/** Map login username (e.g. EMP01) to Firebase Auth email. */
export function loginEmailFromUsername(input: string): string {
  const trimmed = input.trim()
  if (!trimmed) return trimmed
  if (trimmed.includes("@")) return trimmed.toLowerCase()
  return `${trimmed.toLowerCase()}${SCAN_EMPLOYEE_EMAIL_DOMAIN}`
}

/** Display / product tag stamp for known scanner accounts. */
export function accountTagFromEmail(email: string): string | undefined {
  const e = email.trim().toLowerCase()
  const local = e.split("@")[0] ?? ""
  if (/^emp\d+$/i.test(local)) return local.toUpperCase()
  return undefined
}

export const SCANNER_ALLOWED_PREFIXES = ["/scan-edit", "/open-draft-entries"] as const
