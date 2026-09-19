export type AccountMode = "test" | "production"

export const ACCOUNT_MODE_STORAGE_KEY = "samrat_account_mode"
export const TEST_ACCOUNT_PASSKEY = "7269"
export const PRODUCTION_ACCOUNT_PASSKEY = "Ankit@4641"

const SHARED_COLLECTIONS = new Set([
  "gst_purchase_catalogs",
  "gst_purchase_catalog_settings",
  "users",
])

export function getAccountMode(): AccountMode {
  if (typeof window === "undefined") return "test"
  try {
    return window.localStorage.getItem(ACCOUNT_MODE_STORAGE_KEY) === "production" ? "production" : "test"
  } catch {
    return "test"
  }
}

const MODE_CHANGE_EVENT = "samrat-account-mode"

export function setAccountMode(mode: AccountMode): void {
  window.localStorage.setItem(ACCOUNT_MODE_STORAGE_KEY, mode)
  window.dispatchEvent(new Event(MODE_CHANGE_EVENT))
}

export function subscribeAccountMode(onChange: () => void): () => void {
  const handler = () => onChange()
  window.addEventListener(MODE_CHANGE_EVENT, handler)
  window.addEventListener("storage", handler)
  return () => {
    window.removeEventListener(MODE_CHANGE_EVENT, handler)
    window.removeEventListener("storage", handler)
  }
}

/** Firestore collection name for the active account. Test uses existing names (current data). */
export function col(name: string): string {
  if (SHARED_COLLECTIONS.has(name)) return name
  return getAccountMode() === "production" ? `prod_${name}` : name
}

export function offlineDbName(): string {
  return getAccountMode() === "production" ? "samrat-offline-prod-v1" : "samrat-offline-v1"
}

export function accountScopedKey(base: string): string {
  return getAccountMode() === "production" ? `${base}_prod` : base
}
