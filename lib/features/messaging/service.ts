import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
  updateDoc,
  writeBatch,
} from "firebase/firestore"
import { db } from "@/lib/firebase"
import { col } from "@/lib/account-mode"
import { omitUndefinedFields } from "@/lib/utils"
import { convertTimestamp } from "@/lib/inventory/product-from-doc"
import type { Customer, Sale } from "@/lib/types"
import type {
  MessageCampaign,
  MessageCampaignRecipient,
  MessageTemplate,
  MessagingCustomerRow,
} from "./models"

const WALK_IN = new Set(["", "na", "n/a", "walk-in", "walkin"])

export function digitsOnly(value: string): string {
  return value.replace(/\D/g, "")
}

export function isSendablePhone(phone: string): boolean {
  const digits = digitsOnly(phone)
  if (digits.length === 10) return true
  if (digits.length === 12 && digits.startsWith("91")) return true
  if (digits.length === 11 && digits.startsWith("0")) return true
  return false
}

export function smsPhone(phone: string): string {
  const digits = digitsOnly(phone)
  if (digits.length === 10) return `+91${digits}`
  if (digits.length === 12 && digits.startsWith("91")) return `+${digits}`
  if (digits.length === 11 && digits.startsWith("0")) return `+91${digits.slice(1)}`
  return digits
}

export function fillMessageTemplate(
  text: string,
  customer: Pick<MessagingCustomerRow, "name" | "phone" | "purchasedAmount" | "balance">
): string {
  const rupees = (n: number) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(n)
  return text
    .replaceAll("{{name}}", customer.name)
    .replaceAll("{{phone}}", customer.phone)
    .replaceAll("{{purchases}}", rupees(customer.purchasedAmount))
    .replaceAll("{{balance}}", rupees(customer.balance))
}

/**
 * Percent-encode UTF-8 so 4-byte emoji (🪔 🎁 📍) survive the WhatsApp URL.
 * wa.me → api.whatsapp.com often turns those into U+FFFD (�).
 */
export function encodeWhatsAppQuery(text: string): string {
  const wellFormed =
    typeof text.toWellFormed === "function" ? text.toWellFormed() : text
  const bytes = new TextEncoder().encode(wellFormed)
  let out = ""
  for (const byte of bytes) {
    const unreserved =
      (byte >= 0x41 && byte <= 0x5a) ||
      (byte >= 0x61 && byte <= 0x7a) ||
      (byte >= 0x30 && byte <= 0x39) ||
      byte === 0x2d ||
      byte === 0x2e ||
      byte === 0x5f ||
      byte === 0x7e
    if (unreserved) {
      out += String.fromCharCode(byte)
    } else {
      out += `%${byte.toString(16).toUpperCase().padStart(2, "0")}`
    }
  }
  return out
}

export function smsHref(phone: string, body: string): string {
  return `sms:${smsPhone(phone)}?body=${encodeWhatsAppQuery(body)}`
}

export function whatsappAppHref(phone: string, body: string): string {
  const digits = digitsOnly(smsPhone(phone))
  return `whatsapp://send?phone=${digits}&text=${encodeWhatsAppQuery(body)}`
}

export function whatsappWindowName(phone: string): string {
  return `samrat_wa_${digitsOnly(smsPhone(phone))}`
}

export function whatsappHref(phone: string, body: string): string {
  const digits = digitsOnly(smsPhone(phone))
  const text = encodeWhatsAppQuery(body)
  if (typeof navigator !== "undefined" && /Android|iPhone|iPad/i.test(navigator.userAgent)) {
    return whatsappAppHref(phone, body)
  }
  // Unique query so a later customer does not reuse the first WhatsApp Web tab.
  return `https://web.whatsapp.com/send?phone=${digits}&text=${text}`
}

export function openWhatsAppChat(phone: string, body: string): void {
  const webUrl = whatsappHref(phone, body)
  const name = whatsappWindowName(phone)
  window.open(webUrl, name)
}

const QUEUE_STORAGE_KEY = "samrat_whatsapp_send_queue_v1"

export function readStoredWhatsAppQueue(): {
  remaining: MessageCampaignRecipient[]
  total: number
} | null {
  if (typeof window === "undefined") return null
  try {
    const raw = sessionStorage.getItem(QUEUE_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { remaining?: MessageCampaignRecipient[]; total?: number }
    if (!Array.isArray(parsed.remaining) || parsed.remaining.length === 0) return null
    return { remaining: parsed.remaining, total: Number(parsed.total) || parsed.remaining.length }
  } catch {
    return null
  }
}

export function writeStoredWhatsAppQueue(
  remaining: MessageCampaignRecipient[],
  total: number
): void {
  if (typeof window === "undefined") return
  if (remaining.length === 0) {
    sessionStorage.removeItem(QUEUE_STORAGE_KEY)
    return
  }
  sessionStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify({ remaining, total }))
}

export function purchasedTotalsFromSales(sales: Sale[]): Map<string, number> {
  const byId = new Map<string, number>()
  const byPhone = new Map<string, number>()
  for (const sale of sales) {
    const amount = Number(sale.total) || 0
    if (amount <= 0) continue
    const id = (sale.customerId || "").trim()
    if (id) byId.set(id, (byId.get(id) || 0) + amount)
    const phone = digitsOnly(sale.customerPhone || "")
    if (phone && phone !== "NA" && !WALK_IN.has(phone.toLowerCase())) {
      byPhone.set(phone, (byPhone.get(phone) || 0) + amount)
    }
  }
  const merged = new Map<string, number>(byId)
  for (const [phone, amount] of byPhone) {
    merged.set(`phone:${phone}`, amount)
  }
  return merged
}

export function toMessagingRows(
  customers: Customer[],
  sales: Sale[]
): MessagingCustomerRow[] {
  const totals = purchasedTotalsFromSales(sales)
  return customers.map((customer) => {
    const phoneDigits = digitsOnly(customer.phone || "")
    const fromSales =
      Math.max(
        totals.get(customer.id) || 0,
        totals.get(`phone:${phoneDigits}`) || 0
      ) || 0
    const purchasedAmount = Math.max(Number(customer.totalPurchases) || 0, fromSales)
    const name = (customer.name || "").trim() || "Customer"
    return {
      id: customer.id,
      name,
      phone: (customer.phone || "").trim(),
      purchasedAmount,
      balance: Number(customer.balance) || 0,
      hasSendablePhone: isSendablePhone(customer.phone || ""),
    }
  })
}

export function filterMessagingCustomers(
  rows: MessagingCustomerRow[],
  search: string,
  minPurchases: number | null
): MessagingCustomerRow[] {
  const q = search.trim().toLowerCase()
  const qDigits = digitsOnly(search)
  return rows.filter((row) => {
    if (minPurchases != null && row.purchasedAmount <= minPurchases) return false
    if (!q) return true
    const nameHit = row.name.toLowerCase().includes(q)
    const phoneHit =
      row.phone.toLowerCase().includes(q) ||
      (qDigits.length > 0 && digitsOnly(row.phone).includes(qDigits))
    return nameHit || phoneHit
  })
}

function templateFromDoc(id: string, data: Record<string, unknown>): MessageTemplate {
  return {
    id,
    name: String(data.name ?? "").trim() || "Untitled",
    title: String(data.title ?? "").trim(),
    body: String(data.body ?? ""),
    createdAt: convertTimestamp(data.createdAt),
    updatedAt: convertTimestamp(data.updatedAt),
  }
}

export function subscribeMessageTemplates(
  onChange: (templates: MessageTemplate[]) => void,
  onError: (message: string) => void
): () => void {
  const coll = collection(db, col("message_templates"))
  let unsub = () => {}
  const listen = (withOrder: boolean) => {
    unsub = onSnapshot(
      withOrder ? query(coll, orderBy("updatedAt", "desc")) : coll,
      (snap) => {
        const items = snap.docs.map((d) =>
          templateFromDoc(d.id, d.data() as Record<string, unknown>)
        )
        if (!withOrder) {
          items.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
        }
        onChange(items)
      },
      (err) => {
        if (withOrder) {
          listen(false)
          return
        }
        onError(err.message)
      }
    )
  }
  listen(true)
  return () => unsub()
}

export async function saveMessageTemplate(input: {
  id?: string
  name: string
  title: string
  body: string
}): Promise<string> {
  const name = input.name.trim()
  const title = input.title.trim()
  const body = input.body.trim()
  if (!name) throw new Error("Enter a template name")
  if (!title) throw new Error("Enter a notification title")
  if (!body) throw new Error("Enter a message body")
  const payload = omitUndefinedFields({
    name,
    title,
    body,
    updatedAt: Timestamp.now(),
  })
  if (input.id) {
    await updateDoc(doc(db, col("message_templates"), input.id), payload)
    return input.id
  }
  const ref = await addDoc(collection(db, col("message_templates")), {
    ...payload,
    createdAt: Timestamp.now(),
  })
  return ref.id
}

export async function deleteMessageTemplate(id: string): Promise<void> {
  await deleteDoc(doc(db, col("message_templates"), id))
}

export async function recordMessageCampaign(input: {
  templateId?: string
  templateName: string
  title: string
  body: string
  audience: MessageCampaign["audience"]
  minPurchases?: number
  search?: string
  createdBy: string
  recipients: MessageCampaignRecipient[]
}): Promise<string> {
  const campaignRef = await addDoc(
    collection(db, col("message_campaigns")),
    omitUndefinedFields({
      templateId: input.templateId,
      templateName: input.templateName,
      title: input.title,
      body: input.body,
      audience: input.audience,
      recipientCount: input.recipients.length,
      minPurchases: input.minPurchases,
      search: input.search,
      createdBy: input.createdBy,
      createdAt: Timestamp.now(),
    })
  )
  const recipientsCol = collection(
    db,
    col("message_campaigns"),
    campaignRef.id,
    "recipients"
  )
  for (let i = 0; i < input.recipients.length; i += 400) {
    const chunk = input.recipients.slice(i, i + 400)
    const batch = writeBatch(db)
    for (const recipient of chunk) {
      const ref = doc(recipientsCol)
      batch.set(
        ref,
        omitUndefinedFields({
          customerId: recipient.customerId,
          name: recipient.name,
          phone: recipient.phone,
          title: recipient.title,
          body: recipient.body,
          purchasedAmount: recipient.purchasedAmount,
        })
      )
    }
    await batch.commit()
  }
  return campaignRef.id
}

export function campaignFromDoc(id: string, data: Record<string, unknown>): MessageCampaign {
  const audience = data.audience === "all_matching" ? "all_matching" : "selected"
  return {
    id,
    templateId: typeof data.templateId === "string" ? data.templateId : undefined,
    templateName: String(data.templateName ?? ""),
    title: String(data.title ?? ""),
    body: String(data.body ?? ""),
    audience,
    recipientCount: Number(data.recipientCount) || 0,
    minPurchases:
      typeof data.minPurchases === "number" ? data.minPurchases : undefined,
    search: typeof data.search === "string" ? data.search : undefined,
    createdAt: convertTimestamp(data.createdAt),
    createdBy: String(data.createdBy ?? ""),
  }
}

export function subscribeMessageCampaigns(
  onChange: (campaigns: MessageCampaign[]) => void,
  onError: (message: string) => void
): () => void {
  const coll = collection(db, col("message_campaigns"))
  let unsub = () => {}
  const listen = (withOrder: boolean) => {
    unsub = onSnapshot(
      withOrder ? query(coll, orderBy("createdAt", "desc")) : coll,
      (snap) => {
        const items = snap.docs.map((d) =>
          campaignFromDoc(d.id, d.data() as Record<string, unknown>)
        )
        if (!withOrder) {
          items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        }
        onChange(items)
      },
      (err) => {
        if (withOrder) {
          listen(false)
          return
        }
        onError(err.message)
      }
    )
  }
  listen(true)
  return () => unsub()
}
