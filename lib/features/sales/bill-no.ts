/** Online bills: SM-YYYYMMDD-XXXXXX (last 6 of live session id). */
export function generateOnlineBillNo(sessionId: string): string {
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, "")
  const shortId = sessionId.replace(/[^a-zA-Z0-9]/g, "").slice(-6).toUpperCase() || "XXXXXX"
  return `SM-${datePart}-${shortId}`
}

/**
 * Offline bills: SM-YYYYMMDD-O + 8 hex chars from UUID.
 * The "O" prefix keeps them out of the online 6-char session namespace so they
 * do not collide with SM-YYYYMMDD-ZH0G1D style numbers when syncing.
 */
export function generateOfflineBillNo(): string {
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, "")
  const rand =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase()
      : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`.slice(0, 8).toUpperCase()
  return `SM-${datePart}-O${rand}`
}
