import {
  Timestamp,
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  writeBatch,
  type Unsubscribe,
} from "firebase/firestore"
import { db } from "@/lib/firebase"
import { DEFAULT_MASTER_PLAN_BRANCH } from "@/lib/features/master-plan/constants"
import type {
  MasterPlanBranch,
  MasterPlanItem,
  MasterPlanItemInput,
} from "@/lib/features/master-plan/models"
import { MASTER_PLAN_SEED_ITEMS } from "@/lib/features/master-plan/seed-data"

const BRANCHES = "masterPlanBranches"

function toDate(value: unknown): Date {
  if (value instanceof Timestamp) return value.toDate()
  if (value instanceof Date) return value
  return new Date()
}

function branchFromDoc(id: string, data: Record<string, unknown>): MasterPlanBranch {
  return {
    id,
    name: String(data.name ?? ""),
    description: String(data.description ?? ""),
    strategyLabel: String(data.strategyLabel ?? ""),
    investmentCap: Number(data.investmentCap ?? 0),
    isDefault: Boolean(data.isDefault),
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
  }
}

function itemFromDoc(branchId: string, id: string, data: Record<string, unknown>): MasterPlanItem {
  return {
    id,
    branchId,
    category: String(data.category ?? "Groceries") as MasterPlanItem["category"],
    name: String(data.name ?? ""),
    brand: String(data.brand ?? ""),
    size: String(data.size ?? ""),
    whls: Number(data.whls ?? 0),
    mrp: Number(data.mrp ?? 0),
    qty: Number(data.qty ?? 0),
    sortOrder: Number(data.sortOrder ?? 0),
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
  }
}

export class MasterPlanService {
  subscribeBranches(onData: (branches: MasterPlanBranch[]) => void, onError?: (err: Error) => void): Unsubscribe {
    const q = query(collection(db, BRANCHES), orderBy("createdAt", "asc"))
    return onSnapshot(
      q,
      (snap) => {
        onData(snap.docs.map((d) => branchFromDoc(d.id, d.data() as Record<string, unknown>)))
      },
      (err) => onError?.(err)
    )
  }

  subscribeItems(
    branchId: string,
    onData: (items: MasterPlanItem[]) => void,
    onError?: (err: Error) => void
  ): Unsubscribe {
    const q = query(collection(db, BRANCHES, branchId, "items"), orderBy("sortOrder", "asc"))
    return onSnapshot(
      q,
      (snap) => {
        onData(snap.docs.map((d) => itemFromDoc(branchId, d.id, d.data() as Record<string, unknown>)))
      },
      (err) => onError?.(err)
    )
  }

  async seedDefaultBranchIfEmpty(): Promise<string | null> {
    const existing = await getDocs(collection(db, BRANCHES))
    if (!existing.empty) return null

    const branchRef = await addDoc(collection(db, BRANCHES), {
      ...DEFAULT_MASTER_PLAN_BRANCH,
      strategyLabel: `Strategy: ₹8 Lakh Cap (${MASTER_PLAN_SEED_ITEMS.length} High-Variety Items)`,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })

    const batch = writeBatch(db)
    MASTER_PLAN_SEED_ITEMS.forEach((item, index) => {
      const itemRef = doc(collection(db, BRANCHES, branchRef.id, "items"))
      batch.set(itemRef, {
        ...item,
        sortOrder: index + 1,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    })
    await batch.commit()
    return branchRef.id
  }

  async addItem(branchId: string, input: MasterPlanItemInput, sortOrder: number): Promise<string> {
    const ref = await addDoc(collection(db, BRANCHES, branchId, "items"), {
      ...input,
      sortOrder,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
    return ref.id
  }

  async updateItem(branchId: string, itemId: string, input: Partial<MasterPlanItemInput & { qty: number }>): Promise<void> {
    await updateDoc(doc(db, BRANCHES, branchId, "items", itemId), {
      ...input,
      updatedAt: serverTimestamp(),
    })
  }

  async deleteItem(branchId: string, itemId: string): Promise<void> {
    await deleteDoc(doc(db, BRANCHES, branchId, "items", itemId))
  }
}

export const masterPlanService = new MasterPlanService()
