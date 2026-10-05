import { isRegisteredDropdownValue } from "@/lib/inventory/dropdown-registry"

export const PRODUCT_SUPPLIER_REGISTRY_COL = "product_supplier_registry"
export const LEGACY_SUPPLIER_NAMES_COL = "product_supplier_names"

export type SupplierRegistryRow = {
  id: string
  name: string
  contact: string
}

export function isRegisteredSupplierName(name: string, names: string[]): boolean {
  return isRegisteredDropdownValue(name, names)
}

export function contactForSupplierName(
  name: string,
  entries: Pick<SupplierRegistryRow, "name" | "contact">[]
): string {
  const n = name.trim()
  if (!n) return ""
  const row = entries.find((e) => e.name.trim() === n)
  return row?.contact?.trim() ?? ""
}
