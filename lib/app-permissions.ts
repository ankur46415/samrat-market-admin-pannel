/** Feature permissions for staff accounts (admin has all). */

export const APP_PERMISSIONS = [
  { id: "scan-edit", label: "Scan & Edit", pathPrefix: "/scan-edit" },
  { id: "open-draft-entries", label: "Open Draft Entries", pathPrefix: "/open-draft-entries" },
  { id: "draft-entries", label: "Draft Entries", pathPrefix: "/draft-entries" },
  { id: "inventory", label: "Inventory", pathPrefix: "/inventory" },
  { id: "draft-catalog", label: "Inventory → Draft Catalog", pathPrefix: "/inventory/draft-catalog" },
  { id: "generate-bill", label: "Generate Bill", pathPrefix: "/generate-bill" },
  { id: "customers", label: "Customers", pathPrefix: "/customers" },
  { id: "sales", label: "Sales", pathPrefix: "/sales" },
  { id: "reports", label: "Reports", pathPrefix: "/reports" },
] as const

export type AppPermissionId = (typeof APP_PERMISSIONS)[number]["id"]

const PATH_TO_PERMISSION: { prefix: string; id: AppPermissionId }[] = APP_PERMISSIONS.map(
  (p) => ({ prefix: p.pathPrefix, id: p.id })
)

/** Longest-prefix match for permission check. */
export function permissionForPath(pathname: string): AppPermissionId | null {
  const path = pathname || "/"
  if (path === "/" || path === "/settings") return null
  let match: AppPermissionId | null = null
  let bestLen = -1
  for (const { prefix, id } of PATH_TO_PERMISSION) {
    if (path === prefix || path.startsWith(`${prefix}/`)) {
      if (prefix.length > bestLen) {
        bestLen = prefix.length
        match = id
      }
    }
  }
  return match
}

export function pathAllowedByPermissions(
  pathname: string,
  permissions: readonly string[]
): boolean {
  const path = pathname || "/"
  if (path === "/" || path.startsWith("/settings")) {
    return permissions.includes("dashboard") || permissions.length === 0
  }
  const needed = permissionForPath(path)
  if (!needed) return false
  return permissions.includes(needed)
}

export const DEFAULT_SCANNER_PERMISSIONS: AppPermissionId[] = [
  "scan-edit",
  "open-draft-entries",
]

export function normalizePermissionIds(raw: unknown): AppPermissionId[] {
  if (!Array.isArray(raw)) return []
  const valid = new Set(APP_PERMISSIONS.map((p) => p.id))
  return raw.filter((id): id is AppPermissionId => typeof id === "string" && valid.has(id as AppPermissionId))
}
