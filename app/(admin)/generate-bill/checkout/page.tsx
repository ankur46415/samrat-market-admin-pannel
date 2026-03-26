"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { collection, doc, onSnapshot, updateDoc } from "firebase/firestore"
import { ArrowLeft, Search, UserRound, Plus, Minus } from "lucide-react"
import { db } from "@/lib/firebase"
import { useCustomers } from "@/hooks/use-firestore"
import { firestoreNumber } from "@/lib/stock"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  completeLiveBillingSession,
  cancelLiveBillingSession,
} from "@/lib/features/live_billing_admin/services/live_billing_admin_service"

type LiveItem = {
  barcode: string
  name: string
  price: number
  quantity: number
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount)
}

export default function GenerateBillCheckoutPage() {
  const router = useRouter()
  const [sessionId, setSessionId] = useState("")
  const [returnedPhone, setReturnedPhone] = useState("")

  const { customers, loading: customersLoading } = useCustomers()

  const [sessionStatus, setSessionStatus] = useState<string>("active")
  const [items, setItems] = useState<LiveItem[]>([])
  const [loadingItems, setLoadingItems] = useState(true)
  const [customerPhone, setCustomerPhone] = useState("")
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState(false)

  useEffect(() => {
    // Avoid useSearchParams prerender issues in static build.
    const params = new URLSearchParams(window.location.search)
    setSessionId(params.get("sessionId") || "")
    setReturnedPhone(params.get("customerPhone") || "")
  }, [])

  // Handle quantity increment/decrement
  const handleUpdateQuantity = async (barcode: string, newQuantity: number) => {
    if (newQuantity < 1) return // Don't allow zero or negative quantities
    
    try {
      const itemRef = doc(db, "live_sessions", sessionId, "items", barcode)
      await updateDoc(itemRef, { quantity: newQuantity })
      
      // Update local state
      setItems(items.map(item => 
        item.barcode === barcode 
          ? { ...item, quantity: newQuantity }
          : item
      ))
    } catch (error) {
      console.error("[v0] Error updating quantity:", error)
      toast.error("Failed to update quantity")
    }
  }

  const handleIncrementQuantity = (barcode: string, currentQuantity: number) => {
    handleUpdateQuantity(barcode, currentQuantity + 1)
  }

  const handleDecrementQuantity = (barcode: string, currentQuantity: number) => {
    if (currentQuantity > 1) {
      handleUpdateQuantity(barcode, currentQuantity - 1)
    }
  }

  useEffect(() => {
    if (!sessionId) return

    const sessionRef = doc(db, "live_sessions", sessionId)
    const unsubSession = onSnapshot(
      sessionRef,
      (snap) => {
        if (!snap.exists()) {
          setSessionStatus("unknown")
          return
        }
        const data = snap.data() as Record<string, unknown>
        setSessionStatus(String(data.status ?? "active"))
      },
      () => setSessionStatus("unknown")
    )

    const itemsCol = collection(db, "live_sessions", sessionId, "items")
    const unsubItems = onSnapshot(
      itemsCol,
      (snapshot) => {
        const next = snapshot.docs
          .map((d) => {
            const data = d.data() as Record<string, unknown>
            return {
              barcode: String(data.barcode ?? d.id),
              name: String(data.name ?? "").trim(),
              price: firestoreNumber(data.price, 0),
              quantity: firestoreNumber(data.quantity, 0),
            } satisfies LiveItem
          })
          .sort((a, b) => a.name.localeCompare(b.name))
        setItems(next)
        setLoadingItems(false)
      },
      () => {
        setItems([])
        setLoadingItems(false)
      }
    )

    return () => {
      unsubSession()
      unsubItems()
    }
  }, [sessionId])

  useEffect(() => {
    if (!returnedPhone) return
    setCustomerPhone(returnedPhone)
  }, [returnedPhone])

  const normalizedPhone = customerPhone.trim()
  const matchedCustomer = useMemo(() => {
    if (!normalizedPhone) return null
    return customers.find((c) => c.phone.trim() === normalizedPhone) || null
  }, [customers, normalizedPhone])

  const selectedCustomer = useMemo(() => {
    if (!selectedCustomerId) return null
    return customers.find((c) => c.id === selectedCustomerId) || null
  }, [customers, selectedCustomerId])

  useEffect(() => {
    if (matchedCustomer) setSelectedCustomerId(matchedCustomer.id)
  }, [matchedCustomer])

  const totals = useMemo(() => {
    const lines = items.length
    const qty = items.reduce((sum, i) => sum + i.quantity, 0)
    const total = items.reduce((sum, i) => sum + i.quantity * i.price, 0)
    return { lines, qty, total }
  }, [items])

  const handleSearchCustomer = () => {
    if (!normalizedPhone) {
      toast.error("Enter customer phone number first")
      return
    }
    if (matchedCustomer) {
      setSelectedCustomerId(matchedCustomer.id)
      toast.success("Customer found and attached")
      return
    }
    toast.error("Customer not found")
  }

  const handleAddCustomer = () => {
    if (!normalizedPhone) {
      toast.error("Enter customer phone number first")
      return
    }
    const returnTo = `/generate-bill/checkout?sessionId=${encodeURIComponent(sessionId)}`
    router.push(
      `/customers/add?phone=${encodeURIComponent(normalizedPhone)}&returnTo=${encodeURIComponent(returnTo)}`
    )
  }

  const handleCompleteBill = async () => {
    if (!sessionId) return
    try {
      setActionLoading(true)
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
      toast.success(`Bill generated. Sales rows: ${result.salesWritten}`)
      router.push("/generate-bill")
    } catch (e: any) {
      console.error(e)
      const msg = e?.message || "Failed to generate bill"
      toast.error(msg)
    } finally {
      setActionLoading(false)
    }
  }

  const handleCancelBill = async () => {
    if (!sessionId) return
    const ok = window.confirm("Cancel this bill? Status will change to cancelled.")
    if (!ok) return
    try {
      setActionLoading(true)
      await cancelLiveBillingSession(sessionId)
      toast.success("Bill cancelled")
      router.push("/generate-bill")
    } catch (e) {
      console.error(e)
      toast.error("Failed to cancel bill")
    } finally {
      setActionLoading(false)
    }
  }

  if (!sessionId) {
    return (
      <div className="space-y-4">
        <p className="text-muted-foreground">Session not selected.</p>
        <Button asChild>
          <Link href="/generate-bill">Back to Generate Bill</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* ── Header + Action Buttons ── */}
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild className="hover:bg-muted">
            <Link href="/generate-bill">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Bill Checkout</h1>
            <p className="text-sm text-muted-foreground mt-1">Review and complete the payment</p>
          </div>
        </div>

        {/* ── Action Buttons Row ── */}
        <div className="flex gap-3 flex-wrap">
          <Button
            className="h-11 font-semibold flex-1 sm:flex-initial min-w-[180px]"
            onClick={handleCompleteBill}
            disabled={actionLoading || sessionStatus !== "active"}
            size="lg"
          >
            {actionLoading ? (
              <>
                <span className="animate-spin mr-2">⏳</span>
                Processing...
              </>
            ) : (
              "Complete Checkout"
            )}
          </Button>
          <Button
            className="h-11 flex-1 sm:flex-initial min-w-[140px]"
            variant="outline"
            onClick={handleCancelBill}
            disabled={actionLoading || sessionStatus !== "active"}
            size="lg"
          >
            Cancel Bill
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* ── Main Content: Bill Format ── */}
        <div className="lg:col-span-2 space-y-0">
          {/* ── Bill Header with Shop & Customer Info ── */}
          <Card className="border-b-2 border-border/40 rounded-b-none">
            <CardContent className="pt-6">
              <div className="flex items-start justify-between mb-6 pb-6 border-b border-border/40">
                <div>
                  <h2 className="text-2xl font-bold text-foreground">Samrat Market</h2>
                  <p className="text-xs text-muted-foreground mt-1">Premium Supermarket</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-mono text-muted-foreground">Bill ID</p>
                  <p className="text-sm font-bold font-mono">{sessionId.slice(0, 12)}</p>
                </div>
              </div>

              {/* ── Customer Info (if selected) ── */}
              {selectedCustomer && (
                <div className="bg-muted/30 rounded-lg p-3 mb-4">
                  <div className="flex items-center gap-2 text-sm">
                    <UserRound className="h-4 w-4 text-primary" />
                    <div>
                      <p className="font-semibold text-foreground">{selectedCustomer.name}</p>
                      <p className="text-xs text-muted-foreground">{selectedCustomer.phone}</p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── Items Review Table ── */}
          <Card className="border-t-0 rounded-t-none overflow-hidden">
            <CardContent className="p-0">
              {loadingItems ? (
                <div className="space-y-3 p-6">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : items.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-3 py-12 px-6 text-center">
                  <div className="rounded-full bg-muted p-3">
                    <svg className="h-6 w-6 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m0 0l8-4m0 0l8 4m-8-4v10m-8 4l8 4 8-4m-8 4l-8-4m8 4v-10m-8-4l8-4m0 0L3.172 5.172a2 2 0 00-.757 2.828l.6 1.8A2 2 0 005 11v5m0 0l8 4m-8-4l-8-4" />
                    </svg>
                  </div>
                  <p className="text-sm text-muted-foreground">No items in this bill</p>
                </div>
              ) : (
                <div>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader className="bg-muted/50 border-b border-border/40">
                        <TableRow className="hover:bg-transparent border-none">
                          <TableHead className="font-bold text-foreground">Product</TableHead>
                          <TableHead className="text-center font-bold text-foreground">Qty</TableHead>
                          <TableHead className="text-right font-bold text-foreground">Price</TableHead>
                          <TableHead className="text-right font-bold text-foreground">Total</TableHead>
                          <TableHead className="text-center font-bold text-foreground">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {items.map((it) => (
                          <TableRow 
                            key={it.barcode}
                            className="border-border/40 hover:bg-muted/40 transition-colors"
                          >
                            <TableCell className="font-medium text-foreground">{it.name || it.barcode}</TableCell>
                            <TableCell className="text-center">
                              <span className="font-semibold text-foreground">{it.quantity}</span>
                            </TableCell>
                            <TableCell className="text-right text-chart-1 font-semibold">{formatCurrency(it.price)}</TableCell>
                            <TableCell className="text-right font-bold text-chart-1">
                              {formatCurrency(it.quantity * it.price)}
                            </TableCell>
                            <TableCell className="text-center">
                              <div className="flex items-center justify-center gap-1">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleDecrementQuantity(it.barcode, it.quantity)}
                                  disabled={it.quantity <= 1}
                                  className="h-8 w-8 p-0 hover:bg-destructive/10 hover:text-destructive"
                                >
                                  <Minus className="h-3 w-3" />
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleIncrementQuantity(it.barcode, it.quantity)}
                                  className="h-8 w-8 p-0 hover:bg-chart-1/10 hover:text-chart-1"
                                >
                                  <Plus className="h-3 w-3" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <div className="bg-gradient-to-r from-muted/20 via-transparent to-muted/20 p-4 border-t border-border/40 flex justify-end">
                    <div className="text-right">
                      <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-1">
                        Total Amount
                      </p>
                      <p className="text-2xl font-bold text-chart-1">{formatCurrency(totals.total)}</p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ── Right Sidebar ── */}
        <div className="space-y-4">
          {/* ── Customer Section (Compact) ── */}
          <Card className="border-border/50 overflow-hidden">
            <CardHeader className="pb-4 bg-gradient-to-r from-primary/5 via-transparent to-transparent border-b border-border/40">
              <CardTitle className="text-base">Add Customer (Optional)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-4">
              <div className="space-y-2">
                <Label htmlFor="customerPhone" className="text-xs font-semibold text-muted-foreground uppercase">
                  Phone
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="customerPhone"
                    type="tel"
                    placeholder="Phone"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className="font-mono text-sm h-9"
                  />
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={handleSearchCustomer}
                    className="hover:bg-primary hover:text-primary-foreground"
                  >
                    <Search className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {customersLoading ? (
                <Skeleton className="h-12 w-full rounded-lg" />
              ) : selectedCustomer ? (
                <div className="rounded-lg border border-success/30 bg-success/5 p-3 space-y-1">
                  <p className="text-xs text-success font-semibold">✓ Customer Attached</p>
                  <p className="font-semibold text-sm text-foreground">{selectedCustomer.name}</p>
                  <p className="text-xs text-muted-foreground font-mono">{selectedCustomer.phone}</p>
                </div>
              ) : normalizedPhone ? (
                <Button 
                  className="w-full h-9 text-sm" 
                  variant="outline" 
                  onClick={handleAddCustomer}
                >
                  <UserRound className="mr-2 h-4 w-4" />
                  Add New
                </Button>
              ) : null}
            </CardContent>
          </Card>

          {/* ── Quick Summary Card ── */}
          <Card className="border-chart-1/30 bg-gradient-to-br from-chart-1/5 to-primary/5 overflow-hidden">
            <CardContent className="p-4 space-y-2">
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Product Lines</span>
                <span className="font-semibold text-foreground">{totals.lines}</span>
              </div>
              <div className="flex justify-between items-center text-sm border-b border-border/40 pb-2">
                <span className="text-muted-foreground">Total Units</span>
                <span className="font-semibold text-foreground">{totals.qty}</span>
              </div>
              <div className="flex justify-between items-center pt-2">
                <span className="font-semibold text-foreground">Amount Due</span>
                <span className="text-xl font-bold text-chart-1">{formatCurrency(totals.total)}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

