import type { Product } from "@/lib/types"

export function uniqueBrandsFromProducts(products: Product[]): string[] {
  const seen = new Set<string>()
  const list: string[] = []
  for (const p of products) {
    const b = (p.brand ?? "").trim()
    if (!b || seen.has(b)) continue
    seen.add(b)
    list.push(b)
  }
  list.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }))
  return list
}

export function uniqueTagsFromProducts(products: Product[]): string[] {
  const seen = new Set<string>()
  const list: string[] = []
  for (const p of products) {
    const t = (p.tag ?? "").trim()
    if (!t || seen.has(t)) continue
    seen.add(t)
    list.push(t)
  }
  list.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }))
  return list
}
