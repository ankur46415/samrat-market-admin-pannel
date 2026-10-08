import { collection, deleteDoc, doc, getDoc, getDocs, writeBatch } from "firebase/firestore"
import { col } from "@/lib/account-mode"
import { db } from "@/lib/firebase"
import type { CatalogItem, CatalogWrite } from "@/lib/features/shop-catalog/parse"

const BASE = "catalog_items"
const MAX_ROWS = 500

export type CatalogActor = {
  tag: string
  email: string
}

export type CatalogAudit = {
  created_by: string | null
  created_at: string | null
  updated_by: string | null
  updated_at: string | null
  reviewed_by: string | null
  reviewed_at: string | null
}

export type AuditedCatalogItem = CatalogItem & CatalogAudit

function text(value: unknown) {
  return value == null ? "" : String(value)
}

function optional(value: unknown) {
  const clean = text(value).trim()
  return clean ? clean : null
}

function whole(value: unknown, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.trunc(parsed) : fallback
}

function toItem(id: string, data: Record<string, unknown>): AuditedCatalogItem {
  return {
    id,
    name: text(data.name),
    brand: text(data.brand) || "NA",
    category: text(data.category),
    department: text(data.department),
    group_name: text(data.group_name),
    unit: text(data.unit) || "1 pc",
    price: Number(data.price) || 0,
    image: text(data.image),
    tag: optional(data.tag),
    in_stock: data.in_stock !== false,
    is_active: data.is_active !== false,
    group_qty: whole(data.group_qty),
    sort_order: whole(data.sort_order),
    group_id: optional(data.group_id),
    status: optional(data.status),
    created_by: optional(data.created_by),
    created_at: optional(data.created_at),
    updated_by: optional(data.updated_by),
    updated_at: optional(data.updated_at),
    reviewed_by: optional(data.reviewed_by),
    reviewed_at: optional(data.reviewed_at),
  }
}

function payload(item: CatalogWrite, actor: CatalogActor, now: string) {
  const row: Record<string, unknown> = {
    name: item.name,
    brand: item.brand,
    category: item.category,
    department: item.department,
    group_name: item.group_name,
    unit: item.unit,
    price: item.price,
    image: item.image,
    tag: item.tag,
    in_stock: item.in_stock,
    is_active: item.is_active,
    group_qty: item.group_qty,
    sort_order: item.sort_order,
    updated_at: now,
    updated_by: actor.tag,
    updated_by_email: actor.email,
  }
  if (item.group_id) row.group_id = item.group_id
  return row
}

export async function loadShopCatalog() {
  const snap = await getDocs(collection(db, col(BASE)))
  return snap.docs
    .map((entry) => toItem(entry.id, entry.data() as Record<string, unknown>))
    .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))
}

export async function saveShopCatalog(rows: CatalogWrite[], actor: CatalogActor, ownOnly = false) {
  if (rows.length === 0) throw new Error("Add at least one catalog item.")
  if (rows.length > MAX_ROWS) {
    throw new Error(`Import up to ${MAX_ROWS} rows at a time. Split the file and import again.`)
  }
  const name = col(BASE)
  const existing = await getDocs(collection(db, name))
  const known = new Set(existing.docs.map((entry) => entry.id))
  if (ownOnly) {
    const owners = new Map(existing.docs.map((entry) => [entry.id, text(entry.data().created_by).toUpperCase()]))
    const blocked = rows.filter((row) => known.has(row.id) && owners.get(row.id) !== actor.tag)
    if (blocked.length > 0) {
      throw new Error(
        `${blocked.map((row) => row.id).slice(0, 3).join(", ")} already belongs to another account. Use a different id.`,
      )
    }
  }
  const now = new Date().toISOString()
  let saved = 0
  for (let index = 0; index < rows.length; index += 400) {
    const chunk = rows.slice(index, index + 400)
    const batch = writeBatch(db)
    for (const item of chunk) {
      const row = payload(item, actor, now)
      if (!known.has(item.id)) {
        row.status = "Draft"
        row.created_by = actor.tag
        row.created_by_email = actor.email
        row.created_at = now
      }
      batch.set(doc(db, name, item.id), row, { merge: true })
    }
    await batch.commit()
    saved += chunk.length
  }
  return saved
}

export async function setShopCatalogStatus(id: string, status: "live" | "rejected", actor: CatalogActor) {
  const ref = doc(db, col(BASE), id)
  const current = await getDoc(ref)
  if (!current.exists()) throw new Error("That catalog item is already gone.")
  const now = new Date().toISOString()
  const batch = writeBatch(db)
  batch.update(ref, {
    status,
    reviewed_by: actor.tag,
    reviewed_by_email: actor.email,
    reviewed_at: now,
    updated_at: now,
  })
  await batch.commit()
}

export async function deleteShopCatalogItem(id: string) {
  const ref = doc(db, col(BASE), id)
  const current = await getDoc(ref)
  if (!current.exists()) throw new Error("That catalog item is already gone.")
  await deleteDoc(ref)
}
