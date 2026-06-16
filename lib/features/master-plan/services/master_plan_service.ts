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
import {
  DEFAULT_MASTER_PLAN_BRANCH,
  MASTER_PLAN_CATEGORIES,
} from "@/lib/features/master-plan/constants"
import type {
  MasterPlanBranch,
  MasterPlanBranchCategory,
  MasterPlanItem,
  MasterPlanItemInput,
} from "@/lib/features/master-plan/models"
import { MASTER_PLAN_SEED_ITEMS } from "@/lib/features/master-plan/seed-data"
import { CHART_FILLS } from "@/lib/chart-colors"

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
    category: String(data.category ?? ""),
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

function categoryFromDoc(id: string, data: Record<string, unknown>): MasterPlanBranchCategory {
  return {
    id,
    name: String(data.name ?? ""),
    color: String(data.color ?? CHART_FILLS[0]),
    sortOrder: Number(data.sortOrder ?? 0),
    createdAt: toDate(data.createdAt),
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

  subscribeBranchCategories(
    branchId: string,
    onData: (categories: MasterPlanBranchCategory[]) => void,
    onError?: (err: Error) => void
  ): Unsubscribe {
    const q = query(collection(db, BRANCHES, branchId, "categories"), orderBy("sortOrder", "asc"))
    return onSnapshot(
      q,
      (snap) => {
        onData(snap.docs.map((d) => categoryFromDoc(d.id, d.data() as Record<string, unknown>)))
      },
      (err) => onError?.(err)
    )
  }

  async seedDefaultCategories(branchId: string): Promise<void> {
    const existing = await getDocs(collection(db, BRANCHES, branchId, "categories"))
    if (!existing.empty) return

    const batch = writeBatch(db)
    MASTER_PLAN_CATEGORIES.forEach((cat, index) => {
      const ref = doc(db, BRANCHES, branchId, "categories", cat.id)
      batch.set(ref, {
        name: cat.name,
        color: cat.color,
        sortOrder: index + 1,
        createdAt: serverTimestamp(),
      })
    })
    await batch.commit()
  }

  async addBranchCategory(
    branchId: string,
    input: { id: string; name: string; color: string; sortOrder: number }
  ): Promise<string> {
    const ref = doc(db, BRANCHES, branchId, "categories", input.id)
    const existing = await getDoc(ref)
    if (existing.exists()) {
      throw new Error("This category already exists.")
    }
    await setDoc(ref, {
      name: input.name,
      color: input.color,
      sortOrder: input.sortOrder,
      createdAt: serverTimestamp(),
    })
    return input.id
  }

  async updateBranchCategory(branchId: string, id: string, name: string): Promise<void> {
    await updateDoc(doc(db, BRANCHES, branchId, "categories", id), {
      name,
      updatedAt: serverTimestamp(),
    })
  }

  async deleteBranchCategory(branchId: string, id: string): Promise<void> {
    await deleteDoc(doc(db, BRANCHES, branchId, "categories", id))
  }

  async seedDefaultBranchIfEmpty(): Promise<string | null> {
    const existing = await getDocs(collection(db, BRANCHES))
    if (!existing.empty) return null

    const branchRef = await addDoc(collection(db, BRANCHES), {
      ...DEFAULT_MASTER_PLAN_BRANCH,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })

    await this.seedDefaultCategories(branchRef.id)

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

  async createBranch(name: string): Promise<string> {
    const ref = await addDoc(collection(db, BRANCHES), {
      name: name.trim(),
      description: "",
      strategyLabel: "",
      investmentCap: 0,
      isDefault: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
    return ref.id
  }

  async updateBranch(id: string, name: string): Promise<void> {
    await updateDoc(doc(db, BRANCHES, id), {
      name: name.trim(),
      updatedAt: serverTimestamp(),
    })
  }

  async deleteBranch(branchId: string): Promise<void> {
    for (const sub of ["items", "categories"] as const) {
      const snap = await getDocs(collection(db, BRANCHES, branchId, sub))
      const docs = snap.docs
      for (let i = 0; i < docs.length; i += 450) {
        const batch = writeBatch(db)
        docs.slice(i, i + 450).forEach((d) => batch.delete(d.ref))
        await batch.commit()
      }
    }
    await deleteDoc(doc(db, BRANCHES, branchId))
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
