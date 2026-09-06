"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Clock,
  CloudOff,
  Keyboard,
  Loader2,
  Minus,
  Pencil,
  Phone,
  Plus,
  Printer,
  Receipt,
  RotateCcw,
  ScanBarcode,
  Search,
  Trash2,
  XCircle,
} from "lucide-react"
import { toast } from "sonner"
import { useProducts, useCustomers } from "@/hooks/use-firestore"
import { useSessionUser } from "@/lib/auth-session"
import { usePosSession } from "@/hooks/use-pos-session"
import { usePosScanner } from "@/hooks/use-pos-scanner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import {
  cancelLiveBillingSession,
  completeLiveBillingSession,
  forceNewScannerBillingSession,
  getOrCreateScannerBillingSession,
  removeItemFromSession,
  updateSessionItemDiscount,
  updateSessionItemPrice,
  updateSessionItemQuantity,
  type CheckoutCustomerInfo,
  type LiveBillingLineItem,
} from "@/lib/features/live_billing_admin/services/live_billing_admin_service"
import { useLocalPosCart } from "@/lib/offline/use-local-pos-cart"
import { isLikelyNetworkError } from "@/lib/offline/offline-bills"
import { enqueueOfflineBill, syncOneOfflineBill } from "@/lib/offline/sync-offline-bills"
import { useOnlineStatus } from "@/lib/offline/use-online-status"
import { generateOfflineBillNo, generateOnlineBillNo } from "@/lib/features/sales/bill-no"
import type { EditableLiveItem } from "@/components/live-billing/live-bill-items-editor"
import { PosLineDiscountCell } from "@/components/live-billing/pos-line-discount-cell"
import { PosManualItemDialog } from "@/components/live-billing/pos-manual-item-dialog"
import {
  discountedUnitPrice,
  lineItemAmount,
  mrpDiscountPercent,
  mrpLineSaved,
} from "@/lib/billing/line-discount"
import type { ReceiptData } from "@/lib/printing/receipt-data"
import { printReceiptInBrowser } from "@/lib/printing/receipt-html"

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount)
}

function formatClock(date: Date) {
  return date.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
}

const POS_CUSTOMER_STORAGE_PREFIX = "samrat_pos_customer_"

function normalizePosPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "")
  if (digits.length >= 10) return digits.slice(-10)
  return ""
}

function posCustomerStorageKey(sessionId: string) {
  return `${POS_CUSTOMER_STORAGE_PREFIX}${sessionId}`
}

type StoredPosCustomer = { phone: string; name: string; customerId: string }

function readStoredPosCustomer(sessionId: string | null): StoredPosCustomer | null {
  if (!sessionId || typeof window === "undefined") return null
  try {
    const raw = sessionStorage.getItem(posCustomerStorageKey(sessionId))
    if (!raw) return null
    const parsed = JSON.parse(raw) as { phone?: string; name?: string; customerId?: string }
    const phone = normalizePosPhone(String(parsed.phone ?? ""))
    if (!phone) return null
    return {
      phone,
      name: String(parsed.name ?? "").trim(),
      customerId: String(parsed.customerId ?? "").trim(),
    }
  } catch {
    return null
  }
}

function writeStoredPosCustomer(
  sessionId: string | null,
  phone: string,
  name: string,
  customerId = ""
) {
  if (!sessionId || typeof window === "undefined") return
  const digits = normalizePosPhone(phone)
  if (!digits) {
    sessionStorage.removeItem(posCustomerStorageKey(sessionId))
    return
  }
  sessionStorage.setItem(
    posCustomerStorageKey(sessionId),
    JSON.stringify({ phone: digits, name: name.trim(), customerId: customerId.trim() })
  )
}

function readPosCustomerFromUrl(): StoredPosCustomer | null {
  if (typeof window === "undefined") return null
  const params = new URLSearchParams(window.location.search)
  const phone = normalizePosPhone(params.get("customerPhone") || "")
  const name = (params.get("customerName") || "").trim()
  const customerId = (params.get("customerId") || "").trim()
  if (!phone) return null
  return { phone, name, customerId }
}

type PosTerminalProps = {
  sessionId?: string | null
  mode?: "scan" | "checkout"
  onExit?: () => void
  initialCustomerPhone?: string
  initialCustomerName?: string
  initialCustomerId?: string
}

export function PosTerminal({
  sessionId: initialSessionId,
  mode = "scan",
  onExit,
  initialCustomerPhone,
  initialCustomerName,
  initialCustomerId,
}: PosTerminalProps) {
  const router = useRouter()
  const { user } = useSessionUser()
  const { products, loading: productsLoading } = useProducts()
  const { customers, loading: customersLoading, addCustomer } = useCustomers()

  const [sessionId, setSessionId] = useState<string | null>(initialSessionId ?? null)
  const [booting, setBooting] = useState(!initialSessionId)
  const [offlineMode, setOfflineMode] = useState(false)
  const [offlineBillNo, setOfflineBillNo] = useState(() => generateOfflineBillNo())
  const [view, setView] = useState<"billing" | "finalize">(mode === "checkout" ? "finalize" : "billing")
  const [acting, setActing] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [editingItemId, setEditingItemId] = useState<string | null>(null)
  const [editingPrice, setEditingPrice] = useState("")
  const [updatingItemId, setUpdatingItemId] = useState<string | null>(null)
  const [clock, setClock] = useState(() => new Date())
  const [customerPhone, setCustomerPhone] = useState(() => normalizePosPhone(initialCustomerPhone || "") || "NA")
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(initialCustomerId?.trim() || null)
  const [pendingCustomerName, setPendingCustomerName] = useState(initialCustomerName?.trim() || "")
  const [printing, setPrinting] = useState(false)
  const [manualDialogOpen, setManualDialogOpen] = useState(false)
  const [phoneDialogOpen, setPhoneDialogOpen] = useState(false)
  const [nameDraft, setNameDraft] = useState("")
  const [phoneDraft, setPhoneDraft] = useState("NA")
  const [savingCustomer, setSavingCustomer] = useState(false)
  const [resettingScan, setResettingScan] = useState(false)
  const customerInputRef = useRef<HTMLInputElement>(null)

  const cashierName = user?.name || user?.email || "Cashier"
  const productCache = products.map((p) => ({
    id: p.id,
    name: p.name,
    price: p.price,
    barcode: p.barcode,
    mrp: p.mrp,
  }))

  const online = useOnlineStatus()
  const { items: liveItems, loading: liveItemsLoading, sessionStatus, totals: liveTotals } = usePosSession(
    offlineMode ? null : sessionId
  )
  const localCart = useLocalPosCart(offlineMode, sessionId)
  const items = offlineMode ? localCart.items : liveItems
  const itemsLoading = offlineMode ? localCart.loading : liveItemsLoading
  const totals = offlineMode ? localCart.totals : liveTotals
  const isActive = offlineMode || sessionStatus === "active"

  const scanner = usePosScanner({
    sessionId,
    productCache,
    enabled: isActive && view === "billing" && !manualDialogOpen && !editingItemId,
    scanItem: offlineMode ? (_id, barcode, cache) => localCart.scanProduct(barcode, cache) : undefined,
  })

  const scannerFocusPaused =
    manualDialogOpen || phoneDialogOpen || editingItemId != null || view !== "billing" || itemsLoading || booting

  const focusScanInput = useCallback(() => {
    if (!scannerFocusPaused && isActive) {
      scanner.focusInput()
    }
  }, [isActive, scanner, scannerFocusPaused])

  const scannerFocusRef = useRef(scanner.focusInput)
  scannerFocusRef.current = scanner.focusInput

  const normalizedCustomerPhone = customerPhone.trim() || "NA"
  const isWalkInPhone = normalizedCustomerPhone.toUpperCase() === "NA"

  const matchedCustomer =
    !isWalkInPhone
      ? customers.find((c) => normalizePosPhone(c.phone) === normalizePosPhone(normalizedCustomerPhone)) ??
        null
      : null
  const selectedCustomer = customers.find((c) => c.id === selectedCustomerId) ?? matchedCustomer
  const linkedCustomerName = selectedCustomer?.name || pendingCustomerName

  const applyCustomerPhone = useCallback((phone: string, name = "", customerId = "") => {
    const digits = normalizePosPhone(phone)
    if (!digits) {
      setCustomerPhone("NA")
      setSelectedCustomerId(null)
      setPendingCustomerName("")
      writeStoredPosCustomer(sessionId, "", "")
      return
    }
    setCustomerPhone(digits)
    if (name.trim()) setPendingCustomerName(name.trim())
    if (customerId.trim()) setSelectedCustomerId(customerId.trim())
    writeStoredPosCustomer(sessionId, digits, name, customerId)
  }, [sessionId])

  const openPhoneDialog = () => {
    setPhoneDraft(isWalkInPhone ? "" : normalizedCustomerPhone)
    setNameDraft(selectedCustomer?.name || pendingCustomerName)
    setPhoneDialogOpen(true)
  }

  const saveCustomerPhone = async () => {
    const digits = normalizePosPhone(phoneDraft)
    if (!phoneDraft.replace(/\D/g, "")) {
      applyCustomerPhone("")
      setPhoneDialogOpen(false)
      toast.success("Phone set to NA (walk-in)")
      return
    }
    if (!digits) {
      toast.error("Enter a valid 10-digit phone number")
      return
    }
    const found = customers.find((c) => normalizePosPhone(c.phone) === digits)
    const name = (found?.name || nameDraft).trim()
    if (!found && !name) {
      toast.error("Enter customer name")
      return
    }
    try {
      setSavingCustomer(true)
      if (found) {
        applyCustomerPhone(digits, found.name, found.id)
        toast.success(`Customer linked: ${found.name}`)
      } else {
        const newId = await addCustomer({
          name,
          phone: digits,
          balance: 0,
          totalPurchases: 0,
        })
        applyCustomerPhone(digits, name, newId)
        toast.success(`Customer added: ${name}`)
      }
      setPhoneDialogOpen(false)
    } catch (e) {
      console.error(e)
      toast.error("Failed to save customer")
    } finally {
      setSavingCustomer(false)
    }
  }

  const currentBillNo =
    offlineMode || !sessionId ? offlineBillNo : generateOnlineBillNo(sessionId)

  const buildCurrentReceipt = useCallback((): ReceiptData | null => {
    if (items.length === 0) return null
    const phone = selectedCustomer?.phone ?? normalizedCustomerPhone
    return {
      billNo: currentBillNo,
      date: new Date(),
      customerName: selectedCustomer?.name || pendingCustomerName || undefined,
      customerPhone: phone,
      items: items.map((i) => ({
        name: i.name,
        quantity: i.quantity,
        price: discountedUnitPrice(i.price, i.discountPercent),
        basePrice: i.price,
        discountPercent: i.discountPercent,
        mrp: i.mrp,
        total: lineItemAmount(i.quantity, i.price, i.discountPercent),
      })),
      subtotal: items.reduce((sum, i) => sum + i.quantity * i.price, 0),
      discount: totals.discountSaved,
      mrpSavings: totals.mrpSaved,
      total: totals.total,
      paymentMethod: "cash",
      amountPaid: totals.total,
      change: 0,
    }
  }, [currentBillNo, items, normalizedCustomerPhone, pendingCustomerName, selectedCustomer, totals.discountSaved, totals.mrpSaved, totals.total])

  const handlePrintBill = useCallback(() => {
    const receipt = buildCurrentReceipt()
    if (!receipt) {
      toast.error("Scan at least one product first")
      return
    }
    try {
      setPrinting(true)
      printReceiptInBrowser(receipt)
    } catch (e) {
      console.error(e)
      toast.error(e instanceof Error ? e.message : "Print failed")
    } finally {
      setPrinting(false)
    }
  }, [buildCurrentReceipt])

  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    if (offlineMode) setOfflineBillNo(generateOfflineBillNo())
  }, [offlineMode, sessionId])

  useEffect(() => {
    if (initialSessionId) {
      setSessionId(initialSessionId)
      setBooting(false)
      return
    }

    let cancelled = false
    async function boot() {
      try {
        setBooting(true)
        if (!navigator.onLine) {
          setOfflineMode(true)
          if (!cancelled) {
            setSessionId(`offline-${crypto.randomUUID()}`)
            toast.warning("No network. Billing from saved products. Bills go to Offline Billing.")
          }
          return
        }
        const id = await Promise.race([
          getOrCreateScannerBillingSession(cashierName),
          new Promise<string>((_, reject) => {
            window.setTimeout(() => reject(new Error("POS session timeout")), 4000)
          }),
        ])
        if (!cancelled) {
          setOfflineMode(false)
          setSessionId(id)
        }
      } catch (e) {
        console.error(e)
        if (!cancelled) {
          setOfflineMode(true)
          setSessionId(`offline-${crypto.randomUUID()}`)
          toast.warning("Could not reach server. Switched to offline billing.")
        }
      } finally {
        if (!cancelled) setBooting(false)
      }
    }
    void boot()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSessionId])

  useEffect(() => {
    if (scannerFocusPaused || !isActive) return
    requestAnimationFrame(() => scannerFocusRef.current())
  }, [isActive, scannerFocusPaused])

  useEffect(() => {
    const fromUrl = readPosCustomerFromUrl()
    const fromProps =
      normalizePosPhone(initialCustomerPhone || "")
        ? {
            phone: normalizePosPhone(initialCustomerPhone || ""),
            name: (initialCustomerName || "").trim(),
            customerId: (initialCustomerId || "").trim(),
          }
        : null
    const stored = readStoredPosCustomer(sessionId)
    const source = fromUrl || fromProps || stored
    if (source) applyCustomerPhone(source.phone, source.name, source.customerId)
  }, [applyCustomerPhone, initialCustomerId, initialCustomerName, initialCustomerPhone, sessionId])

  useEffect(() => {
    if (!sessionId || isWalkInPhone) return
    writeStoredPosCustomer(sessionId, normalizedCustomerPhone, pendingCustomerName, selectedCustomerId || "")
  }, [isWalkInPhone, normalizedCustomerPhone, pendingCustomerName, selectedCustomerId, sessionId])

  useEffect(() => {
    if (matchedCustomer) {
      setSelectedCustomerId(matchedCustomer.id)
      setPendingCustomerName(matchedCustomer.name)
      writeStoredPosCustomer(sessionId, normalizedCustomerPhone, matchedCustomer.name, matchedCustomer.id)
    }
  }, [matchedCustomer, normalizedCustomerPhone, sessionId])

  useEffect(() => {
    if (editingItemId && !items.some((i) => i.itemDocId === editingItemId)) {
      setEditingItemId(null)
    }
  }, [editingItemId, items])

  const handleResetScan = useCallback(async () => {
    setResettingScan(true)
    try {
      scanner.recoverScanner()
      setEditingItemId(null)
      setSelectedIndex(-1)

      if (!isActive) {
        if (offlineMode) {
          await localCart.clearCart()
          setSessionId(`offline-${crypto.randomUUID()}`)
          toast.success("New offline scan session — ready to scan")
        } else {
          const id = await forceNewScannerBillingSession(cashierName)
          setSessionId(id)
          toast.success("New scan session started — ready to scan")
        }
      } else {
        toast.success("Scanner reset — ready to scan")
      }

      focusScanInput()
    } catch (e) {
      console.error(e)
      toast.error("Failed to reset scanner")
    } finally {
      setResettingScan(false)
    }
  }, [cashierName, focusScanInput, isActive, localCart, offlineMode, scanner])

  const handleRemove = useCallback(
    async (item: EditableLiveItem) => {
      if (!sessionId || !isActive) return
      setRemovingId(item.itemDocId)
      try {
        if (offlineMode) await localCart.removeItem(item.itemDocId)
        else await removeItemFromSession(sessionId, item.itemDocId)
        if (editingItemId === item.itemDocId) setEditingItemId(null)
        focusScanInput()
      } catch (e) {
        console.error(e)
        toast.error("Failed to remove item")
      } finally {
        setRemovingId(null)
      }
    },
    [editingItemId, focusScanInput, isActive, localCart, offlineMode, sessionId]
  )

  const handleQtyChange = useCallback(
    async (item: EditableLiveItem, delta: number) => {
      if (!sessionId || !isActive) return
      const nextQty = item.quantity + delta
      if (nextQty <= 0) {
        if (!window.confirm(`Remove "${item.name}" from bill?`)) return
      }

      setUpdatingItemId(item.itemDocId)
      try {
        if (offlineMode) await localCart.updateQuantity(item.itemDocId, nextQty)
        else await updateSessionItemQuantity(sessionId, item.itemDocId, nextQty)
        if (nextQty <= 0) setEditingItemId(null)
      } catch (e) {
        console.error(e)
        toast.error("Failed to update quantity")
      } finally {
        setUpdatingItemId(null)
      }
    },
    [isActive, localCart, offlineMode, sessionId]
  )

  const handlePriceSave = useCallback(
    async (item: EditableLiveItem) => {
      if (!sessionId || !isActive) return
      const nextPrice = parseFloat(editingPrice)
      if (!Number.isFinite(nextPrice) || nextPrice < 0) {
        toast.error("Enter a valid rate")
        return
      }
      if (nextPrice === item.price) return

      setUpdatingItemId(item.itemDocId)
      try {
        if (offlineMode) await localCart.updatePrice(item.itemDocId, nextPrice)
        else await updateSessionItemPrice(sessionId, item.itemDocId, nextPrice)
        toast.success("Rate updated")
      } catch (e) {
        console.error(e)
        toast.error("Failed to update rate")
      } finally {
        setUpdatingItemId(null)
      }
    },
    [editingPrice, isActive, localCart, offlineMode, sessionId]
  )

  const handleDiscountChange = useCallback(
    async (item: EditableLiveItem, discountPercent: number) => {
      if (!sessionId || !isActive) return
      if (discountPercent === item.discountPercent) return

      setUpdatingItemId(item.itemDocId)
      try {
        if (offlineMode) await localCart.updateDiscount(item.itemDocId, discountPercent)
        else await updateSessionItemDiscount(sessionId, item.itemDocId, discountPercent)
      } catch (e) {
        console.error(e)
        toast.error("Failed to update discount")
      } finally {
        setUpdatingItemId(null)
      }
    },
    [isActive, localCart, offlineMode, sessionId]
  )

  const toggleEditItem = useCallback(
    (item: EditableLiveItem) => {
      if (editingItemId === item.itemDocId) {
        void handlePriceSave(item)
        setEditingItemId(null)
        focusScanInput()
        return
      }
      if (editingItemId) {
        const prev = items.find((i) => i.itemDocId === editingItemId)
        if (prev) void handlePriceSave(prev)
      }
      setEditingItemId(item.itemDocId)
      setEditingPrice(String(item.price))
    },
    [editingItemId, focusScanInput, handlePriceSave, items]
  )

  const handleCancel = useCallback(async () => {
    if (!sessionId) {
      onExit?.()
      router.push("/generate-bill")
      return
    }
    if (!window.confirm("Cancel this bill? All scanned items will be discarded.")) return

    try {
      setActing(true)
      if (offlineMode) {
        await localCart.clearCart()
      } else {
        await cancelLiveBillingSession(sessionId)
      }
      toast.success("Bill cancelled")
      onExit?.()
      router.push("/generate-bill")
    } catch (e) {
      console.error(e)
      toast.error("Failed to cancel bill")
    } finally {
      setActing(false)
    }
  }, [localCart, offlineMode, onExit, router, sessionId])

  const billingCustomer = (): CheckoutCustomerInfo => {
    const customerName = (selectedCustomer?.name || pendingCustomerName || "").trim()
    if (isWalkInPhone) {
      return { customerPhone: normalizedCustomerPhone }
    }
    return {
      customerPhone: selectedCustomer?.phone || normalizedCustomerPhone,
      ...(selectedCustomer?.id || selectedCustomerId
        ? { customerId: selectedCustomer?.id || selectedCustomerId || undefined }
        : {}),
      ...(customerName ? { customerName } : {}),
    }
  }

  const itemsAsLineItems = (): LiveBillingLineItem[] =>
    items.map((item) => ({
      barcode: item.barcode,
      name: item.name,
      price: item.price,
      quantity: item.quantity,
      discountPercent: item.discountPercent,
      ...(item.mrp && item.mrp > 0 ? { mrp: item.mrp } : {}),
    }))

  const handleComplete = useCallback(async () => {
    if (!sessionId || totals.lines === 0) {
      toast.error("Scan at least one product before completing")
      return
    }
    try {
      setActing(true)
      const customer = billingCustomer()

      if (offlineMode) {
        const bill = await enqueueOfflineBill({
          items: localCart.lineItems,
          customer,
          source: "offline_pos",
          liveSessionId: sessionId || undefined,
          billNo: currentBillNo,
        })
        await localCart.clearCart()
        if (navigator.onLine) {
          try {
            await syncOneOfflineBill(bill.id)
            toast.success("Bill completed and synced")
          } catch {
            toast.success("Saved to Offline Billing. Will sync when online.")
          }
        } else {
          toast.success("Saved to Offline Billing. Will sync when online.")
        }
        onExit?.()
        router.push("/generate-bill")
        return
      }

      try {
        const result = await completeLiveBillingSession(sessionId, customer)
        toast.success(result.billNo ? `Bill ${result.billNo} completed` : "Bill completed")
      } catch (e) {
        console.error(e)
        await enqueueOfflineBill({
          items: itemsAsLineItems(),
          customer,
          source: "complete_failed",
          liveSessionId: sessionId,
          billNo: currentBillNo,
        })
        toast.success(
          isLikelyNetworkError(e)
            ? "Network issue. Bill saved to Offline Billing."
            : "Could not complete online. Bill saved to Offline Billing."
        )
      }
      onExit?.()
      router.push("/generate-bill")
    } catch (e) {
      console.error(e)
      toast.error(e instanceof Error ? e.message : "Failed to complete bill")
    } finally {
      setActing(false)
    }
  }, [
    currentBillNo,
    isWalkInPhone,
    items,
    localCart,
    normalizedCustomerPhone,
    offlineMode,
    onExit,
    pendingCustomerName,
    router,
    selectedCustomer,
    selectedCustomerId,
    sessionId,
    totals.lines,
  ])

  const goFinalize = useCallback(() => {
    if (totals.lines === 0) {
      toast.error("Scan at least one product first")
      return
    }
    setView("finalize")
  }, [totals.lines])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (target.closest('[role="dialog"]')) return

      const tag = target.tagName
      const inFormField =
        tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable
      const inCustomerField = tag === "INPUT" && view === "finalize"

      if (e.key === "F3") {
        e.preventDefault()
        void handleResetScan()
        return
      }

      if (e.key === "F2") {
        e.preventDefault()
        setView("billing")
        focusScanInput()
        return
      }

      if (e.key === "F10") {
        if (inFormField) return
        e.preventDefault()
        if (view === "billing") goFinalize()
        else void handleComplete()
        return
      }

      if (e.key === "Escape") {
        if (inFormField || manualDialogOpen) return
        e.preventDefault()
        if (view === "finalize") {
          setView("billing")
          focusScanInput()
        } else {
          void handleCancel()
        }
        return
      }

      if (view === "billing" && !inCustomerField && !inFormField) {
        if (e.key === "Delete" && items.length > 0) {
          e.preventDefault()
          const idx = selectedIndex >= 0 ? selectedIndex : items.length - 1
          const item = items[idx]
          if (item) void handleRemove(item)
          return
        }

        if (e.key === "ArrowDown" && items.length > 0) {
          e.preventDefault()
          setSelectedIndex((i) => Math.min(items.length - 1, i < 0 ? 0 : i + 1))
          return
        }

        if (e.key === "ArrowUp" && items.length > 0) {
          e.preventDefault()
          setSelectedIndex((i) => Math.max(0, i < 0 ? 0 : i - 1))
        }
      }
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [focusScanInput, goFinalize, handleCancel, handleComplete, handleRemove, handleResetScan, items, manualDialogOpen, selectedIndex, view])

  if (booting || (productsLoading && products.length === 0) || !sessionId) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-muted-foreground">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="text-sm font-medium tracking-wide uppercase">Starting POS Terminal…</p>
        </div>
      </div>
    )
  }

  const statusColors = {
    idle: "text-muted-foreground",
    success: "text-success",
    error: "text-destructive",
    processing: "text-warning",
  } as const

  return (
    <div className="flex min-h-[calc(100vh-8rem)] flex-col overflow-hidden rounded-xl border border-border/80 bg-card shadow-lg shadow-black/[0.04]">
      {/* Top bar */}
      <header className="flex shrink-0 items-center justify-between gap-4 border-b border-border/60 bg-muted/25 px-4 py-3 md:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <Button variant="ghost" size="icon" className="shrink-0" asChild>
            <Link href="/generate-bill">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Receipt className="h-5 w-5 shrink-0 text-primary" />
              <h1 className="truncate text-lg font-semibold tracking-tight md:text-xl">Scan & Generate Bill</h1>
            </div>
            <p className="truncate text-xs text-muted-foreground">
              {view === "billing" ? (offlineMode ? "Offline Billing" : "Billing Terminal") : "Payment & Finalize"} · {cashierName}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5 border-primary/30 bg-primary/5 text-primary hover:bg-primary/10"
            onClick={openPhoneDialog}
          >
            <Phone className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Customer Phone</span>
            <span className="sm:hidden">Phone</span>
            {!isWalkInPhone ? (
              <Badge variant="secondary" className="ml-0.5 hidden font-mono text-[10px] md:inline-flex">
                {normalizedCustomerPhone}
              </Badge>
            ) : null}
          </Button>
          <Badge
            variant="outline"
            className={cn(
              "hidden gap-1.5 lg:inline-flex",
              offlineMode || !online
                ? "border-amber-400/50 bg-amber-500/10 text-amber-700 dark:text-amber-400"
                : "border-primary/30 bg-primary/10 text-primary"
            )}
          >
            {offlineMode || !online ? (
              <>
                <CloudOff className="h-3.5 w-3.5" />
                Offline
              </>
            ) : (
              <>
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
                </span>
                {isActive ? "Scanner Live" : sessionStatus}
              </>
            )}
          </Badge>
          <div className="flex items-center gap-1.5 text-sm tabular-nums text-muted-foreground">
            <Clock className="h-4 w-4" />
            {formatClock(clock)}
          </div>
        </div>
      </header>

      <Dialog open={phoneDialogOpen} onOpenChange={setPhoneDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Customer Phone</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="pos-header-phone">10-digit mobile number</Label>
              <Input
                id="pos-header-phone"
                type="tel"
                inputMode="numeric"
                maxLength={10}
                placeholder="9876543210"
                value={phoneDraft}
                onChange={(e) => {
                  const next = e.target.value.replace(/\D/g, "").slice(0, 10)
                  setPhoneDraft(next)
                  const found = customers.find((c) => normalizePosPhone(c.phone) === next)
                  if (found) setNameDraft(found.name)
                }}
                autoFocus
              />
            </div>
            {normalizePosPhone(phoneDraft) ? (
              <div className="space-y-1.5">
                <Label htmlFor="pos-header-name">Customer name</Label>
                <Input
                  id="pos-header-name"
                  placeholder="Ask and enter customer name"
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault()
                      void saveCustomerPhone()
                    }
                  }}
                />
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                Leave empty and save to use <span className="font-mono">NA</span> for walk-in customers.
              </p>
            )}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setPhoneDialogOpen(false)}>
              Cancel
            </Button>
            <Button type="button" disabled={savingCustomer} onClick={() => void saveCustomerPhone()}>
              {savingCustomer ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* Main cart area */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          {view === "billing" && (
            <div className="shrink-0 border-b border-border/60 bg-muted/15 px-4 py-4 md:px-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                <form
                  onSubmit={(e) => {
                    e.preventDefault()
                    scanner.submitScan()
                  }}
                  className="relative min-w-0 flex-1"
                >
                  <ScanBarcode className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-primary" />
                  <input
                    ref={scanner.inputRef}
                    defaultValue=""
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault()
                        scanner.submitScan(e.currentTarget.value)
                      }
                    }}
                    readOnly={scanner.isProcessing}
                    disabled={!isActive}
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck={false}
                    placeholder="Scan barcode — scanner gun auto-focuses here…"
                    className="h-12 w-full rounded-lg border-2 border-primary/30 bg-background pl-12 pr-4 font-mono text-base text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </form>
                <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={resettingScan || acting}
                    className="gap-2"
                    title="Use if barcode gun stops scanning (F3)"
                    onClick={() => void handleResetScan()}
                  >
                    {resettingScan ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RotateCcw className="h-4 w-4" />
                    )}
                    New Scan
                  </Button>
                  <PosManualItemDialog
                    sessionId={sessionId}
                    disabled={!isActive}
                    onOpenChange={setManualDialogOpen}
                    onAdded={focusScanInput}
                    addItem={
                      offlineMode
                        ? async (_id, input) => localCart.addManual(input)
                        : undefined
                    }
                  />
                </div>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                <p className={cn("truncate text-sm font-medium transition-colors", statusColors[scanner.statusTone])}>
                  {scanner.isProcessing && <Loader2 className="mr-1.5 inline h-3.5 w-3.5 animate-spin" />}
                  {scanner.statusMessage}
                </p>
                {scanner.statusTone === "error" && scanner.lastFailedBarcode ? (
                  <Link
                    href={`/inventory/add?barcode=${encodeURIComponent(scanner.lastFailedBarcode)}&returnTo=${encodeURIComponent(`/generate-bill/scan${sessionId ? `?sessionId=${sessionId}` : ""}`)}`}
                    className="shrink-0 text-xs font-semibold text-primary underline-offset-2 hover:underline"
                  >
                    Add product to inventory
                  </Link>
                ) : null}
              </div>
            </div>
          )}

          {/* Cart table */}
          <div className="flex-1 overflow-auto px-4 py-3 md:px-6">
            {itemsLoading ? (
              <div className="flex h-40 items-center justify-center text-muted-foreground">
                <Loader2 className="mr-2 h-6 w-6 animate-spin" /> Loading cart…
              </div>
            ) : items.length === 0 ? (
              <div className="flex h-full min-h-[200px] flex-col items-center justify-center gap-3 text-muted-foreground">
                <ScanBarcode className="h-12 w-12 opacity-40" />
                <p className="text-lg font-medium text-foreground">No items scanned</p>
                <p className="text-sm">Scan barcode or use Add Other for manual items</p>
              </div>
            ) : (
              <table className="w-full text-left">
                <thead className="sticky top-0 z-10 bg-card/95 backdrop-blur">
                  <tr className="border-b border-border text-xs uppercase tracking-wider text-muted-foreground">
                    <th className="w-10 pb-2 pl-1">#</th>
                    <th className="pb-2">Product</th>
                    <th className="w-16 pb-2 text-right">Qty</th>
                    <th className="w-24 pb-2 text-right">Rate</th>
                    <th className="w-28 pb-2 text-right">Discount</th>
                    <th className="w-28 pb-2 text-right">Amount</th>
                    {isActive ? <th className="w-16 pb-2 text-right">Edit</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => {
                    const isLast = scanner.lastScan?.barcode === item.barcode
                    const isSelected = idx === selectedIndex
                    const isEditing = editingItemId === item.itemDocId
                    const isUpdating = updatingItemId === item.itemDocId
                    return (
                      <tr
                        key={item.itemDocId}
                        className={cn(
                          "border-b border-border/60 transition-colors",
                          isSelected && !isEditing && "bg-muted/60",
                          isEditing && "bg-primary/5 ring-1 ring-primary/20",
                          isLast && !isEditing && "animate-pulse bg-primary/5 ring-1 ring-primary/20",
                          scanner.flashKey > 0 && isLast && !isEditing && "duration-500"
                        )}
                        onClick={() => !isEditing && setSelectedIndex(idx)}
                      >
                        <td className="py-3 pl-1 text-sm tabular-nums text-muted-foreground">{idx + 1}</td>
                        <td className="py-3 pr-2">
                          <p className="font-medium leading-snug text-foreground">
                            {item.name}
                            {item.barcode.startsWith("OTHER-") ? (
                              <span className="ml-1.5 rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase text-muted-foreground">
                                Other
                              </span>
                            ) : null}
                          </p>
                          <p className="mt-0.5 font-mono text-xs text-muted-foreground">{item.barcode}</p>
                          {item.mrp &&
                          item.mrp > discountedUnitPrice(item.price, item.discountPercent) ? (
                            <p className="mt-1 text-[11px] font-semibold text-primary">
                              MRP {formatCurrency(item.mrp)} · −
                              {mrpDiscountPercent(
                                item.mrp,
                                discountedUnitPrice(item.price, item.discountPercent)
                              )}
                              % off MRP
                            </p>
                          ) : null}
                        </td>
                        <td className="py-3 text-right">
                          {isEditing ? (
                            <div className="inline-flex items-center gap-1">
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                className="h-8 w-8 shrink-0"
                                disabled={isUpdating}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  void handleQtyChange(item, -1)
                                }}
                              >
                                <Minus className="h-4 w-4" />
                              </Button>
                              <span className="min-w-[2rem] text-center text-lg font-bold tabular-nums text-primary">
                                {isUpdating ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : item.quantity}
                              </span>
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                className="h-8 w-8 shrink-0"
                                disabled={isUpdating}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  void handleQtyChange(item, 1)
                                }}
                              >
                                <Plus className="h-4 w-4" />
                              </Button>
                            </div>
                          ) : (
                            <span className="text-lg font-bold tabular-nums text-primary">{item.quantity}</span>
                          )}
                        </td>
                        <td className="py-3 text-right">
                          {isEditing ? (
                            <Input
                              type="number"
                              min={0}
                              step={1}
                              value={editingPrice}
                              disabled={isUpdating}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => setEditingPrice(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault()
                                  void handlePriceSave(item)
                                }
                              }}
                              onBlur={() => void handlePriceSave(item)}
                              className="ml-auto h-9 w-24 text-right tabular-nums"
                            />
                          ) : (
                            <div className="text-right">
                              <span className="tabular-nums text-muted-foreground">{formatCurrency(item.price)}</span>
                              {item.discountPercent > 0 ? (
                                <p className="text-[11px] font-medium text-primary">
                                  → {formatCurrency(discountedUnitPrice(item.price, item.discountPercent))}
                                </p>
                              ) : null}
                            </div>
                          )}
                        </td>
                        <td className="py-3 text-right">
                          {isActive ? (
                            <PosLineDiscountCell
                              item={item}
                              disabled={!isActive}
                              updating={isUpdating}
                              onChange={(row, pct) => void handleDiscountChange(row, pct)}
                            />
                          ) : item.discountPercent > 0 ? (
                            <span className="text-sm font-medium text-primary">−{item.discountPercent}%</span>
                          ) : (
                            <span className="text-sm text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="py-3 text-right font-semibold tabular-nums text-foreground">
                          {formatCurrency(lineItemAmount(item.quantity, item.price, item.discountPercent))}
                        </td>
                        {isActive ? (
                          <td className="py-3 text-right">
                            <div className="inline-flex items-center gap-0.5">
                              <button
                                type="button"
                                className={cn(
                                  "rounded-lg p-1.5 transition-colors",
                                  isEditing
                                    ? "bg-primary/10 text-primary hover:bg-primary/20"
                                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                                )}
                                disabled={isUpdating}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  toggleEditItem(item)
                                }}
                                title={isEditing ? "Done editing" : "Edit qty & rate"}
                              >
                                {isEditing ? <Check className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
                              </button>
                              {isEditing ? (
                                <button
                                  type="button"
                                  className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                                  disabled={removingId === item.itemDocId || isUpdating}
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    void handleRemove(item)
                                  }}
                                  title="Remove line"
                                >
                                  {removingId === item.itemDocId ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Trash2 className="h-4 w-4" />
                                  )}
                                </button>
                              ) : null}
                            </div>
                          </td>
                        ) : null}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Keyboard hints */}
          <div className="shrink-0 border-t border-border/60 bg-muted/15 px-4 py-2 md:px-6">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Keyboard className="h-3 w-3" /> Shortcuts:
              </span>
              <span>
                <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 text-foreground">F3</kbd> New Scan
              </span>
              <span>
                <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 text-foreground">F2</kbd> Scan
              </span>
              <span>
                <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 text-foreground">F10</kbd> Pay
              </span>
              <span>
                <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 text-foreground">Esc</kbd> Back / Cancel
              </span>
              <span>
                <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 text-foreground">Del</kbd> Remove line
              </span>
              <span>
                <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 text-foreground">↑↓</kbd> Select
              </span>
            </div>
          </div>
        </div>

        {/* Right totals panel */}
        <aside className="flex w-full shrink-0 flex-col border-t border-border/60 bg-muted/10 lg:w-[340px] lg:border-l lg:border-t-0 xl:w-[380px]">
          <div className="border-b border-border/60 p-5">
            <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Grand Total</p>
            <p className="text-4xl font-bold tabular-nums tracking-tight text-foreground xl:text-5xl">
              {formatCurrency(totals.total)}
            </p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-border/60 bg-background px-3 py-2">
                <p className="text-[10px] uppercase text-muted-foreground">Lines</p>
                <p className="text-xl font-bold tabular-nums">{totals.lines}</p>
              </div>
              <div className="rounded-lg border border-border/60 bg-background px-3 py-2">
                <p className="text-[10px] uppercase text-muted-foreground">Total Qty</p>
                <p className="text-xl font-bold tabular-nums">{totals.qty}</p>
              </div>
            </div>
            {totals.mrpSaved > 0 ? (
              <p className="mt-3 text-sm font-semibold text-green-700 dark:text-green-400">
                MRP savings: −{formatCurrency(totals.mrpSaved)}
              </p>
            ) : null}
            {totals.discountSaved > 0 ? (
              <p className={cn("text-sm text-primary", totals.mrpSaved > 0 ? "mt-1" : "mt-3")}>
                Bill discount: −{formatCurrency(totals.discountSaved)}
              </p>
            ) : null}
          </div>

          {view === "finalize" ? (
            <div className="flex-1 space-y-4 overflow-auto p-5">
              <div>
                <Label htmlFor="pos-customer-phone" className="text-xs uppercase tracking-wide text-muted-foreground">
                  Customer Phone
                </Label>
                <div className="mt-2 flex gap-2">
                  <Input
                    ref={customerInputRef}
                    id="pos-customer-phone"
                    type="tel"
                    placeholder="NA or 9876543210"
                    value={customerPhone}
                    onChange={(e) => {
                      setCustomerPhone(e.target.value)
                      setSelectedCustomerId(null)
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="shrink-0"
                    disabled={isWalkInPhone}
                    onClick={() => {
                      if (matchedCustomer) {
                        setSelectedCustomerId(matchedCustomer.id)
                        setPendingCustomerName(matchedCustomer.name)
                        toast.success("Customer attached")
                      } else if (linkedCustomerName && !isWalkInPhone) {
                        toast.success(`Customer attached: ${linkedCustomerName}`)
                      } else if (!isWalkInPhone) {
                        toast.error("Customer not found")
                      }
                    }}
                  >
                    <Search className="h-4 w-4" />
                  </Button>
                </div>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  Default is <span className="font-mono">NA</span> for walk-in. Enter a phone number to link a customer.
                </p>
              </div>

              {customersLoading ? (
                <div className="h-16 animate-pulse rounded-lg bg-muted" />
              ) : linkedCustomerName && !isWalkInPhone ? (
                <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
                  <p className="text-xs uppercase tracking-wide text-primary">Customer</p>
                  <p className="mt-1 font-semibold text-foreground">{linkedCustomerName}</p>
                  <p className="text-sm text-muted-foreground">{normalizedCustomerPhone}</p>
                </div>
              ) : !isWalkInPhone ? (
                <p className="text-xs text-muted-foreground">
                  Use <span className="font-medium">Customer Phone</span> at the top to add name with this number.
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">Walk-in bill — phone saved as NA in sales history</p>
              )}
            </div>
          ) : (
            <div className="flex-1 p-5">
              {scanner.lastScan ? (
                <div
                  key={scanner.flashKey}
                  className="animate-in fade-in rounded-xl border border-primary/20 bg-primary/5 p-4 duration-200"
                >
                  <p className="text-xs uppercase tracking-wide text-primary/80">Last Scan</p>
                  <p className="mt-1 font-semibold leading-snug text-foreground">{scanner.lastScan.name}</p>
                  <p className="mt-1 font-mono text-sm text-muted-foreground">{scanner.lastScan.barcode}</p>
                  <p className="mt-2 text-lg font-bold tabular-nums text-primary">
                    Qty {scanner.lastScan.quantity} × {formatCurrency(scanner.lastScan.price)}
                  </p>
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                  Last scanned product appears here
                </div>
              )}
            </div>
          )}

          <div className="shrink-0 space-y-2 border-t border-border/60 bg-muted/15 p-5">
            <Button
              variant="secondary"
              className="h-12 w-full text-base font-semibold"
              disabled={totals.lines === 0 || printing || acting}
              onClick={handlePrintBill}
            >
              {printing ? (
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              ) : (
                <Printer className="mr-2 h-5 w-5" />
              )}
              Print this bill
            </Button>

            {view === "billing" ? (
              <>
                <Button className="h-12 w-full text-base font-semibold" disabled={!isActive || totals.lines === 0 || acting} onClick={goFinalize}>
                  <CheckCircle2 className="mr-2 h-5 w-5" />
                  Pay & Complete
                  <span className="ml-auto text-xs font-normal opacity-70">F10</span>
                </Button>
                <Button variant="outline" className="w-full" disabled={acting} onClick={() => void handleCancel()}>
                  <XCircle className="mr-2 h-4 w-4" />
                  Cancel Bill
                </Button>
              </>
            ) : (
              <>
                <Button
                  className="h-12 w-full text-base font-semibold"
                  disabled={!isActive || acting || totals.lines === 0}
                  onClick={() => void handleComplete()}
                >
                  {acting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <CheckCircle2 className="mr-2 h-5 w-5" />}
                  Complete Bill — {formatCurrency(totals.total)}
                  <span className="ml-auto text-xs font-normal opacity-70">F10</span>
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  disabled={acting}
                  onClick={() => {
                    setView("billing")
                    focusScanInput()
                  }}
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to Scan
                  <span className="ml-auto text-xs opacity-60">Esc</span>
                </Button>
              </>
            )}
          </div>
        </aside>
      </div>
    </div>
  )
}
