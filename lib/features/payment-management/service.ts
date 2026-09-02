import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore"
import { db } from "@/lib/firebase"
import { omitUndefinedFields } from "@/lib/utils"
import type { PaymentLedgerEntry, PaymentPayee } from "./models"

const PAYEES_COL = "payment_payees"
const ENTRIES_COL = "payment_ledger"

function toDate(v: unknown): Date {
  if (v instanceof Timestamp) return v.toDate()
  if (v instanceof Date) return v
  const d = new Date(String(v ?? ""))
  return Number.isNaN(d.getTime()) ? new Date() : d
}

function payeeFromFirestore(id: string, data: Record<string, unknown>): PaymentPayee {
  return {
    id,
    name: String(data.name ?? "").trim() || "Unnamed",
    phone: String(data.phone ?? "").trim() || undefined,
    notes: String(data.notes ?? "").trim() || undefined,
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
  }
}

function entryFromFirestore(id: string, data: Record<string, unknown>): PaymentLedgerEntry {
  const type = data.type === "payment" ? "payment" : "purchase"
  const amount = Number(data.amount)
  return {
    id,
    payeeId: String(data.payeeId ?? ""),
    type,
    amount: Number.isFinite(amount) && amount > 0 ? amount : 0,
    date: toDate(data.date ?? data.createdAt),
    notes: String(data.notes ?? "").trim() || undefined,
    createdAt: toDate(data.createdAt),
  }
}

export function subscribePaymentPayees(
  onData: (payees: PaymentPayee[]) => void,
  onError?: (error: Error) => void
) {
  const q = query(collection(db, PAYEES_COL), orderBy("name", "asc"))
  return onSnapshot(
    q,
    (snap) => {
      onData(snap.docs.map((d) => payeeFromFirestore(d.id, d.data() as Record<string, unknown>)))
    },
    (err) => {
      console.error("Payment payees subscribe error:", err)
      onError?.(err)
    }
  )
}

export function subscribePaymentLedger(
  onData: (entries: PaymentLedgerEntry[]) => void,
  onError?: (error: Error) => void
) {
  return onSnapshot(
    collection(db, ENTRIES_COL),
    (snap) => {
      const rows = snap.docs.map((d) => entryFromFirestore(d.id, d.data() as Record<string, unknown>))
      rows.sort((a, b) => b.date.getTime() - a.date.getTime() || b.createdAt.getTime() - a.createdAt.getTime())
      onData(rows)
    },
    (err) => {
      console.error("Payment ledger subscribe error:", err)
      onError?.(err)
    }
  )
}

export async function addPaymentPayee(input: { name: string; phone?: string; notes?: string }): Promise<string> {
  const ref = await addDoc(
    collection(db, PAYEES_COL),
    omitUndefinedFields({
      name: input.name.trim(),
      phone: input.phone?.trim() || undefined,
      notes: input.notes?.trim() || undefined,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    })
  )
  return ref.id
}

export async function updatePaymentPayee(
  id: string,
  input: { name: string; phone?: string; notes?: string }
): Promise<void> {
  await updateDoc(
    doc(db, PAYEES_COL, id),
    omitUndefinedFields({
      name: input.name.trim(),
      phone: input.phone?.trim() || "",
      notes: input.notes?.trim() || "",
      updatedAt: Timestamp.now(),
    })
  )
}

export async function deletePaymentPayee(id: string): Promise<void> {
  const entriesSnap = await getDocs(query(collection(db, ENTRIES_COL), where("payeeId", "==", id)))
  const docs = [doc(db, PAYEES_COL, id), ...entriesSnap.docs.map((d) => d.ref)]
  for (let i = 0; i < docs.length; i += 450) {
    const batch = writeBatch(db)
    docs.slice(i, i + 450).forEach((ref) => batch.delete(ref))
    await batch.commit()
  }
}

export async function addPaymentLedgerEntry(input: {
  payeeId: string
  type: "purchase" | "payment"
  amount: number
  date: Date
  notes?: string
}): Promise<string> {
  const amount = Number(input.amount)
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("Enter a valid amount")
  const ref = await addDoc(
    collection(db, ENTRIES_COL),
    omitUndefinedFields({
      payeeId: input.payeeId,
      type: input.type,
      amount,
      date: Timestamp.fromDate(input.date),
      notes: input.notes?.trim() || undefined,
      createdAt: Timestamp.now(),
    })
  )
  return ref.id
}

export async function deletePaymentLedgerEntry(id: string): Promise<void> {
  await deleteDoc(doc(db, ENTRIES_COL, id))
}
