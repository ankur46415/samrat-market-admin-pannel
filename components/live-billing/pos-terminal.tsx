"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Clock,
  Keyboard,
  Loader2,
  Minus,
  Pencil,
  Plus,
  Receipt,
  ScanBarcode,
  Search,
  Trash2,
  UserRound,
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
import { cn } from "@/lib/utils"
import {
  cancelLiveBillingSession,
  completeLiveBillingSession,
  getOrCreateScannerBillingSession,
  removeItemFromSession,
  updateSessionItemPrice,
  updateSessionItemQuantity,
} from "@/lib/features/live_billing_admin/services/live_billing_admin_service"
import type { EditableLiveItem } from "@/components/live-billing/live-bill-items-editor"

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

type PosTerminalProps = {
  sessionId?: string | null
  mode?: "scan" | "checkout"
  onExit?: () => void
}

export function PosTerminal({ sessionId: initialSessionId, mode = "scan", onExit }: PosTerminalProps) {
  const router = useRouter()
  const { user } = useSessionUser()
  const { products, loading: productsLoading } = useProducts()
  const { customers, loading: customersLoading } = useCustomers()

  const [sessionId, setSessionId] = useState<string | null>(initialSessionId ?? null)
  const [booting, setBooting] = useState(!initialSessionId)
  const [view, setView] = useState<"billing" | "finalize">(mode === "checkout" ? "finalize" : "billing")
  const [acting, setActing] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [editingItemId, setEditingItemId] = useState<string | null>(null)
  const [editingPrice, setEditingPrice] = useState("")
  const [updatingItemId, setUpdatingItemId] = useState<string | null>(null)
  const [clock, setClock] = useState(() => new Date())
  const [customerPhone, setCustomerPhone] = useState("")
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null)
  const customerInputRef = useRef<HTMLInputElement>(null)

  const cashierName = user?.name || user?.email || "Cashier"
  const productCache = products.map((p) => ({
    id: p.id,
    name: p.name,
    price: p.price,
    barcode: p.barcode,
  }))

  const { items, loading: itemsLoading, sessionStatus, totals } = usePosSession(sessionId)
  const isActive = sessionStatus === "active"

  const scanner = usePosScanner({
    sessionId,
    productCache,
    enabled: isActive && view === "billing",
  })

  const matchedCustomer = customers.find((c) => c.phone.trim() === customerPhone.trim()) ?? null
  const selectedCustomer = customers.find((c) => c.id === selectedCustomerId) ?? matchedCustomer

  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

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
        const id = await getOrCreateScannerBillingSession(cashierName)
        if (!cancelled) setSessionId(id)
      } catch (e) {
        console.error(e)
        toast.error("Failed to start POS session")
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
    if (view === "billing" && isActive && !itemsLoading && !booting) {
      scanner.focusInput()
    }
  }, [view, isActive, itemsLoading, booting, scanner])

  useEffect(() => {
    if (matchedCustomer) setSelectedCustomerId(matchedCustomer.id)
  }, [matchedCustomer])

  useEffect(() => {
    if (editingItemId && !items.some((i) => i.itemDocId === editingItemId)) {
      setEditingItemId(null)
    }
  }, [editingItemId, items])

  const handleRemove = useCallback(
    async (item: EditableLiveItem) => {
      if (!sessionId || !isActive) return
      setRemovingId(item.itemDocId)
      try {
        await removeItemFromSession(sessionId, item.itemDocId)
        if (editingItemId === item.itemDocId) setEditingItemId(null)
        scanner.focusInput()
      } catch (e) {
        console.error(e)
        toast.error("Failed to remove item")
      } finally {
        setRemovingId(null)
      }
    },
    [editingItemId, isActive, scanner, sessionId]
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
        await updateSessionItemQuantity(sessionId, item.itemDocId, nextQty)
        if (nextQty <= 0) setEditingItemId(null)
      } catch (e) {
        console.error(e)
        toast.error("Failed to update quantity")
      } finally {
        setUpdatingItemId(null)
      }
    },
    [isActive, sessionId]
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
        await updateSessionItemPrice(sessionId, item.itemDocId, nextPrice)
        toast.success("Rate updated")
      } catch (e) {
        console.error(e)
        toast.error("Failed to update rate")
      } finally {
        setUpdatingItemId(null)
      }
    },
    [editingPrice, isActive, sessionId]
  )

  const toggleEditItem = useCallback(
    (item: EditableLiveItem) => {
      if (editingItemId === item.itemDocId) {
        void handlePriceSave(item)
        setEditingItemId(null)
        scanner.focusInput()
        return
      }
      if (editingItemId) {
        const prev = items.find((i) => i.itemDocId === editingItemId)
        if (prev) void handlePriceSave(prev)
      }
      setEditingItemId(item.itemDocId)
      setEditingPrice(String(item.price))
    },
    [editingItemId, handlePriceSave, items, scanner]
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
      await cancelLiveBillingSession(sessionId)
      toast.success("Bill cancelled")
      onExit?.()
      router.push("/generate-bill")
    } catch (e) {
      console.error(e)
      toast.error("Failed to cancel bill")
    } finally {
      setActing(false)
    }
  }, [onExit, router, sessionId])

  const handleComplete = useCallback(async () => {
    if (!sessionId || totals.lines === 0) {
      toast.error("Scan at least one product before completing")
      return
    }
    try {
      setActing(true)
      const result = await completeLiveBillingSession(
        sessionId,
        selectedCustomer
          ? {
              customerId: selectedCustomer.id,
              customerName: selectedCustomer.name,
              customerPhone: selectedCustomer.phone,
            }
          : undefined
      )
      toast.success(result.billNo ? `Bill ${result.billNo} completed` : "Bill completed")
      onExit?.()
      router.push("/generate-bill")
    } catch (e) {
      console.error(e)
      toast.error(e instanceof Error ? e.message : "Failed to complete bill")
    } finally {
      setActing(false)
    }
  }, [onExit, router, selectedCustomer, sessionId, totals.lines])

  const goFinalize = useCallback(() => {
    if (totals.lines === 0) {
      toast.error("Scan at least one product first")
      return
    }
    setView("finalize")
  }, [totals.lines])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      const inCustomerField = tag === "INPUT" && view === "finalize"

      if (e.key === "F2") {
        e.preventDefault()
        setView("billing")
        scanner.focusInput()
        return
      }

      if (e.key === "F10") {
        e.preventDefault()
        if (view === "billing") goFinalize()
        else void handleComplete()
        return
      }

      if (e.key === "Escape") {
        e.preventDefault()
        if (view === "finalize") {
          setView("billing")
          scanner.focusInput()
        } else {
          void handleCancel()
        }
        return
      }

      if (view === "billing" && !inCustomerField) {
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
  }, [goFinalize, handleCancel, handleComplete, handleRemove, items, scanner, selectedIndex, view])

  if (booting || productsLoading || !sessionId) {
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
              {view === "billing" ? "Billing Terminal" : "Payment & Finalize"} · {cashierName}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <Badge variant="outline" className="hidden gap-1.5 border-primary/30 bg-primary/10 text-primary sm:inline-flex">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
            </span>
            {isActive ? "Scanner Live" : sessionStatus}
          </Badge>
          <div className="flex items-center gap-1.5 text-sm tabular-nums text-muted-foreground">
            <Clock className="h-4 w-4" />
            {formatClock(clock)}
          </div>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* Main cart area */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          {view === "billing" && (
            <div className="shrink-0 border-b border-border/60 bg-muted/15 px-4 py-4 md:px-6">
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  scanner.submitScan()
                }}
                className="relative"
              >
                <ScanBarcode className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-primary" />
                <input
                  ref={scanner.inputRef}
                  value={scanner.scanValue}
                  onChange={(e) => scanner.setScanValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault()
                      scanner.submitScan(e.currentTarget.value)
                    }
                  }}
                  disabled={!isActive}
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="Scan barcode — scanner gun auto-focuses here…"
                  className="h-12 w-full rounded-lg border-2 border-primary/30 bg-background pl-12 pr-4 font-mono text-base text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </form>
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
                <p className="text-sm">Point scanner at barcode — items appear instantly</p>
              </div>
            ) : (
              <table className="w-full text-left">
                <thead className="sticky top-0 z-10 bg-card/95 backdrop-blur">
                  <tr className="border-b border-border text-xs uppercase tracking-wider text-muted-foreground">
                    <th className="w-10 pb-2 pl-1">#</th>
                    <th className="pb-2">Product</th>
                    <th className="w-16 pb-2 text-right">Qty</th>
                    <th className="w-24 pb-2 text-right">Rate</th>
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
                          <p className="font-medium leading-snug text-foreground">{item.name}</p>
                          <p className="mt-0.5 font-mono text-xs text-muted-foreground">{item.barcode}</p>
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
                            <span className="tabular-nums text-muted-foreground">{formatCurrency(item.price)}</span>
                          )}
                        </td>
                        <td className="py-3 text-right font-semibold tabular-nums text-foreground">
                          {formatCurrency(item.quantity * item.price)}
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
          </div>

          {view === "finalize" ? (
            <div className="flex-1 space-y-4 overflow-auto p-5">
              <div>
                <Label htmlFor="pos-customer-phone" className="text-xs uppercase tracking-wide text-muted-foreground">
                  Customer Phone (Optional)
                </Label>
                <div className="mt-2 flex gap-2">
                  <Input
                    ref={customerInputRef}
                    id="pos-customer-phone"
                    type="tel"
                    placeholder="9876543210"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="shrink-0"
                    onClick={() => {
                      if (matchedCustomer) {
                        setSelectedCustomerId(matchedCustomer.id)
                        toast.success("Customer attached")
                      } else if (customerPhone.trim()) {
                        toast.error("Customer not found")
                      }
                    }}
                  >
                    <Search className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {customersLoading ? (
                <div className="h-16 animate-pulse rounded-lg bg-muted" />
              ) : selectedCustomer ? (
                <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
                  <p className="text-xs uppercase tracking-wide text-primary">Customer</p>
                  <p className="mt-1 font-semibold text-foreground">{selectedCustomer.name}</p>
                  <p className="text-sm text-muted-foreground">{selectedCustomer.phone}</p>
                </div>
              ) : customerPhone.trim() ? (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() =>
                    router.push(
                      `/customers/add?phone=${encodeURIComponent(customerPhone)}&returnTo=${encodeURIComponent(`/generate-bill/checkout?sessionId=${sessionId}`)}`
                    )
                  }
                >
                  <UserRound className="mr-2 h-4 w-4" />
                  Add New Customer
                </Button>
              ) : (
                <p className="text-xs text-muted-foreground">Walk-in customer — skip phone to complete faster</p>
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
                    scanner.focusInput()
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
