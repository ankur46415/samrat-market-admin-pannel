"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { collection, doc, onSnapshot } from "firebase/firestore"
import { ArrowLeft, Search, UserRound } from "lucide-react"
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
    <div className="space-y-8">
      {/* ── Header Section ── */}
      <div className="space-y-3 border-b border-border/40 pb-8">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild className="hover:bg-muted">
              <Link href="/generate-bill">
                <ArrowLeft className="h-5 w-5" />
              </Link>
            </Button>
            <div>
              <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-primary via-primary to-accent bg-clip-text text-transparent">
                Checkout
              </h1>
              <p className="text-base text-muted-foreground mt-2">Review and finalize the bill</p>
            </div>
          </div>
          <Badge 
            variant={sessionStatus === "active" ? "default" : "secondary"}
            className="h-fit px-3 py-1.5 text-sm"
          >
            {sessionStatus}
          </Badge>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* ── Main Content ── */}
        <div className="lg:col-span-2 space-y-6">
          {/* ── Session Overview ── */}
          <Card className="border-primary/30 bg-gradient-to-br from-card via-card to-primary/5 hover:border-primary/50 transition-colors">
            <CardHeader className="pb-6">
              <CardTitle className="text-xl">Session Overview</CardTitle>
              <CardDescription className="text-sm font-mono text-chart-1">
                {sessionId}
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-border/60 bg-card/50 backdrop-blur-sm p-4 hover:bg-muted/30 transition-colors">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2">
                  Product Lines
                </p>
                <p className="text-2xl font-bold text-foreground">{totals.lines}</p>
              </div>
              <div className="rounded-lg border border-border/60 bg-card/50 backdrop-blur-sm p-4 hover:bg-muted/30 transition-colors">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2">
                  Total Units
                </p>
                <p className="text-2xl font-bold text-foreground">{totals.qty}</p>
              </div>
              <div className="rounded-lg border border-chart-1/30 bg-gradient-to-br from-chart-1/10 to-primary/5 p-4 hover:border-chart-1/50 transition-colors">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2">
                  Amount Due
                </p>
                <p className="text-2xl font-bold text-chart-1">{formatCurrency(totals.total)}</p>
              </div>
            </CardContent>
          </Card>

          {/* ── Items Review ── */}
          <Card className="border-border/50 overflow-hidden">
            <CardHeader className="pb-6 bg-gradient-to-r from-chart-1/5 via-transparent to-transparent border-b border-border/40">
              <CardTitle className="text-xl">Items in Bill</CardTitle>
              <CardDescription className="text-sm">Review all scanned items before checkout</CardDescription>
            </CardHeader>
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
                          <TableHead className="text-right font-bold text-foreground">Qty</TableHead>
                          <TableHead className="text-right font-bold text-foreground">Price</TableHead>
                          <TableHead className="text-right font-bold text-foreground">Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {items.map((it) => (
                          <TableRow 
                            key={it.barcode}
                            className="border-border/40 hover:bg-muted/40 transition-colors"
                          >
                            <TableCell className="font-medium text-foreground">{it.name || it.barcode}</TableCell>
                            <TableCell className="text-right font-semibold text-foreground">{it.quantity}</TableCell>
                            <TableCell className="text-right text-chart-1 font-semibold">{formatCurrency(it.price)}</TableCell>
                            <TableCell className="text-right font-bold text-chart-1">
                              {formatCurrency(it.quantity * it.price)}
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
        <div className="space-y-6">
          {/* ── Customer Section ── */}
          <Card className="border-border/50 overflow-hidden">
            <CardHeader className="pb-6 bg-gradient-to-r from-primary/5 via-transparent to-transparent border-b border-border/40">
              <CardTitle className="text-lg">Customer Details</CardTitle>
              <CardDescription className="text-sm">Optional: Attach customer to bill</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-6">
              <div className="space-y-2">
                <Label htmlFor="customerPhone" className="font-semibold text-foreground">
                  Phone Number
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="customerPhone"
                    type="tel"
                    placeholder="e.g., 9876543210"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className="font-mono"
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
                <Skeleton className="h-14 w-full rounded-lg" />
              ) : selectedCustomer ? (
                <div className="rounded-lg border border-success/30 bg-success/5 p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="rounded-full bg-success/20 p-2">
                      <UserRound className="h-4 w-4 text-success" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">
                        Attached Customer
                      </p>
                      <p className="font-bold text-foreground text-sm">{selectedCustomer.name}</p>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground/80 font-mono">{selectedCustomer.phone}</p>
                </div>
              ) : normalizedPhone ? (
                <div className="rounded-lg border border-warning/30 bg-warning/5 p-4 space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Customer not found. Create a new one?
                  </p>
                  <Button 
                    className="w-full" 
                    variant="outline" 
                    onClick={handleAddCustomer}
                  >
                    <UserRound className="mr-2 h-4 w-4" />
                    Add New Customer
                  </Button>
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-border/40 bg-muted/20 p-4 text-center">
                  <p className="text-xs text-muted-foreground">Enter phone to search</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── Action Buttons ── */}
          <Card className="border-border/50 overflow-hidden">
            <CardHeader className="pb-4 bg-gradient-to-r from-primary/5 via-transparent to-transparent border-b border-border/40">
              <CardTitle className="text-lg">Complete Checkout</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-6">
              <Button
                className="w-full h-11 text-base font-semibold"
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
                  "Complete Bill"
                )}
              </Button>
              <Button
                className="w-full h-11"
                variant="outline"
                onClick={handleCancelBill}
                disabled={actionLoading || sessionStatus !== "active"}
                size="lg"
              >
                Cancel Bill
              </Button>
            </CardContent>
          </Card>

          {/* ── Bill Summary ── */}
          <Card className="border-chart-1/30 bg-gradient-to-br from-chart-1/5 to-primary/5 overflow-hidden">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">Bill Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between items-center py-2 border-b border-border/40">
                <span className="text-sm text-muted-foreground">Items</span>
                <span className="font-semibold text-foreground">{totals.lines}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-border/40">
                <span className="text-sm text-muted-foreground">Total Units</span>
                <span className="font-semibold text-foreground">{totals.qty}</span>
              </div>
              <div className="flex justify-between items-center py-3 pt-4 border-t-2 border-border/40">
                <span className="font-bold text-foreground">Amount Due</span>
                <span className="text-2xl font-bold text-chart-1">{formatCurrency(totals.total)}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

