import {
  Timestamp,
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
  type Unsubscribe,
} from "firebase/firestore"
import { db } from "@/lib/firebase"
import { DEFAULT_MASTER_PLAN_BRANCH } from "@/lib/features/master-plan/constants"
import type {
  MasterPlanBranch,
  MasterPlanCustomCategory,
  MasterPlanItem,
  MasterPlanItemInput,
} from "@/lib/features/master-plan/models"
import { MASTER_PLAN_SEED_ITEMS } from "@/lib/features/master-plan/seed-data"

import { CHART_FILLS } from "@/lib/chart-colors"

const BRANCHES = "masterPlanBranches"
const CUSTOM_CATEGORIES = "masterPlanCategories"

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

function customCategoryFromDoc(id: string, data: Record<string, unknown>): MasterPlanCustomCategory {
  return {
    id,
    name: String(data.name ?? ""),
    color: String(data.color ?? CHART_FILLS[0]),
    createdAt: toDate(data.createdAt),
  }
}

export class MasterPlanService {
  subscribeCustomCategories(
    onData: (categories: MasterPlanCustomCategory[]) => void,
    onError?: (err: Error) => void
  ): Unsubscribe {
    const q = query(collection(db, CUSTOM_CATEGORIES), orderBy("createdAt", "asc"))
    return onSnapshot(
      q,
      (snap) => {
        onData(snap.docs.map((d) => customCategoryFromDoc(d.id, d.data() as Record<string, unknown>)))
      },
      (err) => onError?.(err)
    )
  }

  async addCustomCategory(input: { id: string; name: string; color: string }): Promise<string> {
    const ref = doc(db, CUSTOM_CATEGORIES, input.id)
    const existing = await getDoc(ref)
    if (existing.exists()) {
      throw new Error("This category already exists.")
    }
    await setDoc(ref, {
      name: input.name,
      color: input.color,
      createdAt: serverTimestamp(),
    })
    return input.id
  }

  async deleteCustomCategory(id: string): Promise<void> {
    await deleteDoc(doc(db, CUSTOM_CATEGORIES, id))
  }

  async updateCustomCategory(id: string, name: string): Promise<void> {
    await updateDoc(doc(db, CUSTOM_CATEGORIES, id), {
      name,
      updatedAt: serverTimestamp(),
    })
  }

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
