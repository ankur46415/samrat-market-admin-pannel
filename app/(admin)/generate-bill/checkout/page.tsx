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
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        {/* ── Back Navigation ── */}
        <Button 
          variant="ghost" 
          size="sm" 
          asChild 
          className="mb-8 text-muted-foreground hover:text-foreground"
        >
          <Link href="/generate-bill" className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Billing
          </Link>
        </Button>

        {/* ── Main Checkout Container ── */}
        <div className="grid gap-8 lg:grid-cols-3">
          {/* ── Bill Section (Left/Main) ── */}
          <div className="lg:col-span-2 space-y-0">
            {/* ── Invoice Card ── */}
            <Card className="shadow-xl border-border/60 rounded-b-none overflow-hidden">
              {/* ── Invoice Header ── */}
              <CardContent className="p-8 border-b-2 border-border/40">
                <div className="flex items-start justify-between gap-4 mb-8">
                  <div>
                    <h1 className="text-3xl font-bold text-foreground">Samrat Market</h1>
                    <p className="text-sm text-muted-foreground mt-1">Premium Supermarket</p>
                  </div>
                  <div className="text-right bg-muted/50 rounded-lg p-4">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Bill Number</p>
                    <p className="text-2xl font-mono font-bold text-primary mt-2">{sessionId.slice(0, 12)}</p>
                  </div>
                </div>

                {/* ── Customer Information ── */}
                {selectedCustomer ? (
                  <div className="bg-gradient-to-r from-primary/10 to-accent/10 rounded-lg p-4 border border-primary/30">
                    <div className="flex items-center gap-3">
                      <div className="rounded-full bg-primary/20 p-3">
                        <UserRound className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Customer</p>
                        <p className="font-bold text-lg text-foreground">{selectedCustomer.name}</p>
                        <p className="text-sm text-muted-foreground font-mono">{selectedCustomer.phone}</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-muted/40 rounded-lg p-4 text-center border border-dashed border-border/40">
                    <p className="text-sm text-muted-foreground">No customer attached to this bill</p>
                  </div>
                )}
              </CardContent>

              {/* ── Items Table ── */}
              <CardContent className="p-0">
                {loadingItems ? (
                  <div className="space-y-2 p-8">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                  </div>
                ) : items.length === 0 ? (
                  <div className="flex flex-col items-center justify-center gap-3 py-16 px-8">
                    <div className="rounded-full bg-muted p-4">
                      <svg className="h-8 w-8 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m0 0l8-4m0 0l8 4m-8-4v10m-8 4l8 4 8-4m-8 4l-8-4m8 4v-10m-8-4l8-4" />
                      </svg>
                    </div>
                    <p className="text-muted-foreground font-medium">No items added to this bill</p>
                  </div>
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader className="bg-muted/50 border-b border-border/40">
                          <TableRow className="hover:bg-transparent border-none">
                            <TableHead className="font-bold text-foreground text-sm">Product</TableHead>
                            <TableHead className="text-center font-bold text-foreground text-sm">Qty</TableHead>
                            <TableHead className="text-right font-bold text-foreground text-sm">Unit Price</TableHead>
                            <TableHead className="text-right font-bold text-foreground text-sm">Amount</TableHead>
                            <TableHead className="text-center font-bold text-foreground text-sm w-20">Adjust</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {items.map((it) => (
                            <TableRow 
                              key={it.barcode}
                              className="border-border/40 hover:bg-muted/50 transition-colors"
                            >
                              <TableCell className="font-medium text-foreground py-4">{it.name || it.barcode}</TableCell>
                              <TableCell className="text-center font-semibold text-foreground py-4">{it.quantity}</TableCell>
                              <TableCell className="text-right text-chart-1 font-semibold py-4">{formatCurrency(it.price)}</TableCell>
                              <TableCell className="text-right font-bold text-chart-1 py-4">
                                {formatCurrency(it.quantity * it.price)}
                              </TableCell>
                              <TableCell className="text-center py-4">
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

                    {/* ── Invoice Footer ── */}
                    <div className="border-t border-border/40 p-8 bg-muted/20">
                      <div className="flex flex-col gap-4 max-w-xs ml-auto">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Subtotal ({totals.lines} items)</span>
                          <span className="font-semibold text-foreground">{formatCurrency(totals.total)}</span>
                        </div>
                        <div className="border-t border-border/40 pt-4 flex justify-between">
                          <span className="font-bold text-foreground">Total Amount</span>
                          <span className="text-3xl font-bold text-chart-1">{formatCurrency(totals.total)}</span>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          {/* ── Right Sidebar: Customer & Payment ── */}
          <div className="space-y-6">
            {/* ── Customer Card ── */}
            <Card className="border-border/60 shadow-lg">
              <CardHeader className="pb-4 bg-gradient-to-br from-primary/5 to-accent/5 border-b border-border/40">
                <CardTitle className="text-lg">Customer Details</CardTitle>
                <CardDescription className="text-xs">Optional - Attach customer to bill</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 pt-6">
                <div className="space-y-2">
                  <Label htmlFor="customerPhone" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Phone Number
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      id="customerPhone"
                      type="tel"
                      placeholder="9876543210"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      className="font-mono h-10"
                    />
                    <Button 
                      variant="outline" 
                      size="icon"
                      onClick={handleSearchCustomer}
                      className="hover:bg-primary hover:text-primary-foreground"
                    >
                      <Search className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {customersLoading ? (
                  <Skeleton className="h-16 w-full rounded-lg" />
                ) : selectedCustomer ? (
                  <div className="rounded-lg border border-success/40 bg-gradient-to-br from-success/10 to-success/5 p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-success text-lg">✓</span>
                      <p className="text-xs font-bold text-success uppercase tracking-wide">Customer Attached</p>
                    </div>
                    <p className="font-bold text-foreground">{selectedCustomer.name}</p>
                    <p className="text-xs text-muted-foreground font-mono mt-1">{selectedCustomer.phone}</p>
                  </div>
                ) : normalizedPhone ? (
                  <Button 
                    className="w-full h-10" 
                    onClick={handleAddCustomer}
                  >
                    <UserRound className="mr-2 h-4 w-4" />
                    Add New Customer
                  </Button>
                ) : (
                  <p className="text-xs text-muted-foreground text-center py-4">Enter phone to search</p>
                )}
              </CardContent>
            </Card>

            {/* ── Bill Summary Card ── */}
            <Card className="border-chart-1/40 bg-gradient-to-br from-chart-1/5 to-transparent shadow-lg">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg">Bill Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Items</span>
                    <span className="font-semibold text-foreground">{totals.lines}</span>
                  </div>
                  <div className="flex justify-between text-sm border-b border-border/40 pb-3">
                    <span className="text-muted-foreground">Total Qty</span>
                    <span className="font-semibold text-foreground">{totals.qty}</span>
                  </div>
                  <div className="flex justify-between pt-2">
                    <span className="font-bold text-foreground">Total Due</span>
                    <span className="text-2xl font-bold text-chart-1">{formatCurrency(totals.total)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* ── Action Buttons at Bottom ── */}
        <div className="mt-8 flex gap-3 pt-8 border-t border-border/40">
          <Button
            onClick={handleCompleteBill}
            disabled={actionLoading || sessionStatus !== "active"}
            size="lg"
            className="flex-1 h-12 text-base font-semibold"
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
            variant="outline"
            onClick={handleCancelBill}
            disabled={actionLoading || sessionStatus !== "active"}
            size="lg"
            className="h-12 text-base font-semibold min-w-[160px]"
          >
            Cancel Bill
          </Button>
        </div>
      </div>
    </div>
  )
}

