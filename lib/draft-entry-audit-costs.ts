/** Local-only bill line costs on Draft Entries (not stored on products or Firestore). */

const STORAGE_KEY = "samrat_draft_entry_audit_costs_v1"

export type DraftAuditCostMap = Record<string, number>

function readRaw(): DraftAuditCostMap {
  if (typeof window === "undefined") return {}
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, unknown>
    const out: DraftAuditCostMap = {}
    for (const [id, v] of Object.entries(parsed)) {
      const n = typeof v === "number" ? v : Number(v)
      if (Number.isFinite(n) && n >= 0) out[id] = n
    }
    return out
  } catch {
    return {}
  }
}

export function loadDraftAuditCosts(): DraftAuditCostMap {
  return readRaw()
}

export function saveDraftAuditCosts(map: DraftAuditCostMap): void {
  if (typeof window === "undefined") return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map))
}

export function setDraftAuditCost(draftId: string, amount: number | null): DraftAuditCostMap {
  const next = readRaw()
  if (amount == null || !Number.isFinite(amount) || amount < 0) {
    delete next[draftId]
  } else {
    next[draftId] = amount
  }
  saveDraftAuditCosts(next)
  return next
}

/** Drop costs for drafts that no longer exist. */
export function pruneDraftAuditCosts(validDraftIds: string[]): DraftAuditCostMap {
  const valid = new Set(validDraftIds)
  const next = readRaw()
  let changed = false
  for (const id of Object.keys(next)) {
    if (!valid.has(id)) {
      delete next[id]
      changed = true
    }
  }
  if (changed) saveDraftAuditCosts(next)
  return next
}

export function sumDraftAuditCosts(
  draftIds: string[],
  map: DraftAuditCostMap
): number {
  return draftIds.reduce((sum, id) => sum + (map[id] ?? 0), 0)
}

/** Local-only “line matches bill” flags on Draft Entries. */
const OK_STORAGE_KEY = "samrat_draft_entry_audit_ok_v1"

export type DraftAuditOkMap = Record<string, boolean>

function readOkRaw(): DraftAuditOkMap {
  if (typeof window === "undefined") return {}
  try {
    const raw = localStorage.getItem(OK_STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, unknown>
    const out: DraftAuditOkMap = {}
    for (const [id, v] of Object.entries(parsed)) {
      if (v === true) out[id] = true
    }
    return out
  } catch {
    return {}
  }
}

export function loadDraftAuditOk(): DraftAuditOkMap {
  return readOkRaw()
}

export function saveDraftAuditOk(map: DraftAuditOkMap): void {
  if (typeof window === "undefined") return
  localStorage.setItem(OK_STORAGE_KEY, JSON.stringify(map))
}

export function setDraftAuditOk(draftId: string, ok: boolean): DraftAuditOkMap {
  const next = readOkRaw()
  if (ok) next[draftId] = true
  else delete next[draftId]
  saveDraftAuditOk(next)
  return next
}

export function pruneDraftAuditOk(validDraftIds: string[]): DraftAuditOkMap {
  const valid = new Set(validDraftIds)
  const next = readOkRaw()
  let changed = false
  for (const id of Object.keys(next)) {
    if (!valid.has(id)) {
      delete next[id]
      changed = true
    }
  }
  if (changed) saveDraftAuditOk(next)
  return next
}

export function countDraftAuditOk(draftIds: string[], okMap: DraftAuditOkMap): number {
  return draftIds.filter((id) => okMap[id] === true).length
}

/** Sum bill costs only for rows marked OK. */
export function sumOkMarkedBillCosts(
  draftIds: string[],
  okMap: DraftAuditOkMap,
  costMap: DraftAuditCostMap
): number {
  return draftIds.reduce((sum, id) => (okMap[id] === true ? sum + (costMap[id] ?? 0) : sum), 0)
}

const UNIT_COST_STORAGE_KEY = "samrat_draft_entry_audit_unit_cost_v1"

export type DraftAuditUnitCostMap = Record<string, number>

function readUnitCostRaw(): DraftAuditUnitCostMap {
  if (typeof window === "undefined") return {}
  try {
    const raw = localStorage.getItem(UNIT_COST_STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, unknown>
    const out: DraftAuditUnitCostMap = {}
    for (const [id, v] of Object.entries(parsed)) {
      const n = typeof v === "number" ? v : Number(v)
      if (Number.isFinite(n) && n >= 0) out[id] = n
    }
    return out
  } catch {
    return {}
  }
}

export function loadDraftAuditUnitCosts(): DraftAuditUnitCostMap {
  return readUnitCostRaw()
}

export function saveDraftAuditUnitCosts(map: DraftAuditUnitCostMap): void {
  if (typeof window === "undefined") return
  localStorage.setItem(UNIT_COST_STORAGE_KEY, JSON.stringify(map))
}

export function setDraftAuditUnitCost(draftId: string, unitCost: number | null): DraftAuditUnitCostMap {
  const next = readUnitCostRaw()
  if (unitCost == null || !Number.isFinite(unitCost) || unitCost < 0) {
    delete next[draftId]
  } else {
    next[draftId] = unitCost
  }
  saveDraftAuditUnitCosts(next)
  return next
}

export function pruneDraftAuditUnitCosts(validDraftIds: string[]): DraftAuditUnitCostMap {
  const valid = new Set(validDraftIds)
  const next = readUnitCostRaw()
  let changed = false
  for (const id of Object.keys(next)) {
    if (!valid.has(id)) {
      delete next[id]
      changed = true
    }
  }
  if (changed) saveDraftAuditUnitCosts(next)
  return next
}

export function roundMoney(n: number): number {
  return Math.round(n * 100) / 100
}

export function defaultLineBillTotal(qty: number, unitCost: number): number {
  if (!Number.isFinite(qty) || qty <= 0) return 0
  if (!Number.isFinite(unitCost) || unitCost < 0) return 0
  return roundMoney(qty * unitCost)
}

export function unitCostFromBillTotal(total: number, qty: number): number {
  if (!Number.isFinite(total) || total < 0 || !Number.isFinite(qty) || qty <= 0) return 0
  return roundMoney(total / qty)
}
