/** Used only until departments are added in Manage Dropdown. */
export const DEPARTMENTS = ["grocery", "footwear", "cosmetics", "stationery"] as const

export type CatalogWrite = {
  id: string
  name: string
  brand: string
  category: string
  department: string
  group_name: string
  unit: string
  price: number
  image: string
  tag: string | null
  in_stock: boolean
  is_active: boolean
  group_qty: number
  sort_order: number
  group_id?: string
}

export type CatalogItem = Omit<CatalogWrite, "group_id"> & {
  group_id?: string | null
  status?: string | null
}

export type RowError = {
  row: number
  message: string
}

const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]*$/

function canonKey(key: string) {
  return key.trim().toLowerCase().replace(/[\s-]+/g, "_")
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  const out: Record<string, unknown> = {}
  for (const [key, item] of Object.entries(value)) out[canonKey(key)] = item
  return out
}

function pick(raw: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = raw[key]
    if (value != null && value !== "") return value
  }
  return undefined
}

function readBool(
  value: unknown,
  fallback: boolean,
  label: string,
): { ok: true; value: boolean } | { ok: false; error: string } {
  if (value == null || value === "") return { ok: true, value: fallback }
  if (typeof value === "boolean") return { ok: true, value }
  if (typeof value === "number") {
    if (value === 1) return { ok: true, value: true }
    if (value === 0) return { ok: true, value: false }
  }
  const text = String(value).trim().toLowerCase()
  if (["true", "yes", "y", "1"].includes(text)) return { ok: true, value: true }
  if (["false", "no", "n", "0"].includes(text)) return { ok: true, value: false }
  return { ok: false, error: `${label} must be true or false` }
}

function readWholeNumber(
  value: unknown,
  fallback: number,
  label: string,
  allowNegative: boolean,
): { ok: true; value: number } | { ok: false; error: string } {
  if (value == null || value === "") return { ok: true, value: fallback }
  const parsed = typeof value === "number" ? value : Number(String(value).trim())
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) {
    return { ok: false, error: `${label} must be a whole number` }
  }
  if (!allowNegative && parsed < 0) return { ok: false, error: `${label} cannot be negative` }
  return { ok: true, value: parsed }
}

export function slugifyId(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
}

function uniqueSuffix() {
  const bytes = new Uint8Array(4)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")
}

export function createCatalogId(name: string, used: Set<string>) {
  const base = slugifyId(name) || "item"
  let id = `${base}-${uniqueSuffix()}`
  while (used.has(id)) id = `${base}-${uniqueSuffix()}`
  return id
}

export function normalizeCatalogItem(
  value: unknown,
  row: number,
  usedIds?: Set<string>,
): { item?: CatalogWrite; error?: string } {
  const raw = asRecord(value)
  if (!raw) return { error: `Row ${row}: each item must be an object` }

  const problems: string[] = []
  let id = String(pick(raw, ["id"]) ?? "").trim()
  const name = String(pick(raw, ["name"]) ?? "").trim()
  const brand = String(pick(raw, ["brand"]) ?? "NA").trim() || "NA"
  const category = String(pick(raw, ["category"]) ?? "").trim()
  const departmentRaw = pick(raw, ["department"])
  const department =
    departmentRaw == null || String(departmentRaw).trim() === ""
      ? ""
      : String(departmentRaw).trim().toLowerCase()
  const groupName = String(pick(raw, ["group_name", "group"]) ?? "").trim()
  const unit = String(pick(raw, ["unit"]) ?? "1 pc").trim()
  const image = String(pick(raw, ["image"]) ?? "").trim()
  const tagValue = pick(raw, ["tag"])
  const tag = tagValue == null || String(tagValue).trim() === "" ? null : String(tagValue).trim()
  const groupRaw = pick(raw, ["group_id", "batch_id"])
  const groupId = groupRaw == null || String(groupRaw).trim() === "" ? "" : String(groupRaw).trim()

  if (!id) id = createCatalogId(name, usedIds ?? new Set())
  else if (!ID_PATTERN.test(id)) {
    problems.push("id can use letters, numbers, hyphens, and underscores (example: onion-1kg)")
  }
  if (!name) problems.push("name is required")
  if (!unit) problems.push("unit is required")
  if (!image) problems.push("image is required (a photo URL)")

  const priceRaw = pick(raw, ["price"])
  const price = priceRaw == null || priceRaw === "" ? Number.NaN : Number(String(priceRaw).trim())
  if (!Number.isFinite(price) || price < 0) problems.push("price must be a number, 0 or more")

  const inStock = readBool(raw.in_stock ?? raw.instock, true, "in_stock")
  if (!inStock.ok) problems.push(inStock.error)
  const active = readBool(raw.is_active ?? raw.active, true, "is_active")
  if (!active.ok) problems.push(active.error)
  const qty = readWholeNumber(pick(raw, ["group_qty", "batch_qty", "qty", "quantity"]), 0, "group_qty", false)
  if (!qty.ok) problems.push(qty.error)
  const sort = readWholeNumber(pick(raw, ["sort_order", "sort"]), 0, "sort_order", true)
  if (!sort.ok) problems.push(sort.error)
  if (groupId && !ID_PATTERN.test(groupId) && !/^[0-9a-f-]{36}$/i.test(groupId)) {
    problems.push("group_id must be letters, numbers, hyphens, or a UUID")
  }
  if (!category) problems.push("category is required")
  if (!groupName) problems.push("group name is required")
  if (!department) problems.push("department is required")

  if (problems.length || !inStock.ok || !active.ok || !qty.ok || !sort.ok) {
    const label = id ? `Row ${row} (${id})` : `Row ${row}`
    return { error: `${label}: ${problems.join("; ")}` }
  }

  const item: CatalogWrite = {
    id,
    name,
    brand,
    category,
    department,
    group_name: groupName,
    unit,
    price,
    image,
    tag,
    in_stock: inStock.value,
    is_active: active.value,
    group_qty: qty.value,
    sort_order: sort.value,
  }
  if (groupId) item.group_id = groupId
  return { item }
}

export function normalizeCatalogItems(values: unknown[], startRow = 1) {
  const items: CatalogWrite[] = []
  const errors: RowError[] = []
  const seen = new Map<string, number>()
  const usedIds = new Set<string>()

  values.forEach((value, index) => {
    const row = startRow + index
    const result = normalizeCatalogItem(value, row, usedIds)
    if (result.error || !result.item) {
      errors.push({ row, message: result.error || `Row ${row}: invalid item` })
      return
    }
    const previous = seen.get(result.item.id)
    if (previous) {
      errors.push({
        row,
        message: `Row ${row}: id ${result.item.id} is repeated (first used on row ${previous})`,
      })
      return
    }
    seen.set(result.item.id, row)
    usedIds.add(result.item.id)
    items.push(result.item)
  })

  return { items, errors }
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ""
  let inQuotes = false
  const src = text.replace(/^\uFEFF/, "")

  for (let i = 0; i < src.length; i += 1) {
    const char = src[i]
    if (inQuotes) {
      if (char === '"') {
        if (src[i + 1] === '"') {
          cell += '"'
          i += 1
        } else inQuotes = false
      } else cell += char
      continue
    }
    if (char === '"') inQuotes = true
    else if (char === ",") {
      row.push(cell)
      cell = ""
    } else if (char === "\n") {
      row.push(cell)
      rows.push(row)
      row = []
      cell = ""
    } else if (char !== "\r") cell += char
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell)
    rows.push(row)
  }
  return rows.filter((line) => line.some((value) => value.trim() !== ""))
}

export function parseImport(text: string) {
  const trimmed = text.trim()
  if (!trimmed) return { items: [] as CatalogWrite[], errors: [{ row: 1, message: "Paste or choose a CSV or JSON file first." }] }
  if (trimmed.startsWith("[") || trimmed.startsWith("{")) return fromJson(trimmed)
  return fromCsv(trimmed)
}

function fromCsv(text: string) {
  const table = parseCsv(text)
  if (table.length === 0) return { items: [], errors: [{ row: 1, message: "The file is empty." }] }
  const headers = table[0].map((value) => value.trim().toLowerCase().replace(/[\s-]+/g, "_"))
  if (!headers.includes("id") || !headers.includes("name")) {
    return {
      items: [],
      errors: [{ row: 1, message: "CSV needs a header row with id and name. Download the sample file and keep that first row." }],
    }
  }
  const records = table.slice(1).map((line) => {
    const record: Record<string, string> = {}
    headers.forEach((key, index) => {
      if (!key) return
      record[key] = line[index] ?? ""
    })
    return record
  })
  return normalizeCatalogItems(records, 2)
}

function fromJson(text: string) {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return { items: [], errors: [{ row: 1, message: "This JSON could not be read. Check commas and quotes." }] }
  }
  let list: unknown[] | null = null
  if (Array.isArray(parsed)) list = parsed
  else if (parsed && typeof parsed === "object") {
    const record = parsed as Record<string, unknown>
    if (Array.isArray(record.items)) list = record.items
    else if (Array.isArray(record.products)) list = record.products
    else list = [parsed]
  }
  if (!list) return { items: [], errors: [{ row: 1, message: "JSON must be a list of products, or one product object." }] }
  if (list.length === 0) return { items: [], errors: [{ row: 1, message: "The JSON list is empty." }] }
  return normalizeCatalogItems(list)
}
