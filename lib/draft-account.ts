import type { Product } from "@/lib/types"

/** Staff account that created the draft (e.g. EMP01). Distinct from merchandising `tag`. */
export function draftOwnerAccountKey(product: Pick<Product, "ownerAccountTag">): string {
  const raw = product.ownerAccountTag?.trim()
  return raw ? raw.toUpperCase() : ""
}

export function draftGroupedAccountLabel(product: Pick<Product, "ownerAccountTag">): string {
  return draftOwnerAccountKey(product) || "Unassigned"
}

export function draftOwnedBySessionAccount(
  product: Pick<Product, "ownerAccountTag">,
  accountTag?: string
): boolean {
  if (!accountTag?.trim()) return false
  const owner = draftOwnerAccountKey(product)
  if (!owner) return false
  return owner === accountTag.trim().toUpperCase()
}
