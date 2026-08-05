"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { collection, doc, onSnapshot } from "firebase/firestore"
import { ArrowLeft, Search, UserRound } from "lucide-react"
import { db } from "@/lib/firebase"
import { useCustomers } from "@/hooks/use-firestore"
import { firestoreNumber, liveSessionItemQuantity } from "@/lib/stock"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { LiveSessionBillEditor } from "@/components/live-billing/live-session-bill-editor"
import {
  completeLiveBillingSession,
  cancelLiveBillingSession,
} from "@/lib/features/live_billing_admin/services/live_billing_admin_service"

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
  const [itemCount, setItemCount] = useState(0)
  const [itemQty, setItemQty] = useState(0)
  const [itemTotal, setItemTotal] = useState(0)
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
        let qty = 0
        let total = 0
        for (const d of snapshot.docs) {
          const data = d.data() as Record<string, unknown>
          const q = liveSessionItemQuantity(data)
          const p = firestoreNumber(data.price, 0)
          qty += q
          total += q * p
        }
        setItemCount(snapshot.docs.length)
        setItemQty(qty)
        setItemTotal(total)
        setLoadingItems(false)
      },
      () => {
        setItemCount(0)
        setItemQty(0)
        setItemTotal(0)
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

  const totals = useMemo(
    () => ({
      lines: itemCount,
      qty: itemQty,
      total: itemTotal,
    }),
    [itemCount, itemQty, itemTotal]
  )

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
      toast.success(
        result.billNo
          ? `Bill ${result.billNo} saved with ${result.completedItems} item(s)`
          : `Bill saved with ${result.completedItems} item(s)`
      )
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
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/generate-bill">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Checkout</h1>
            <p className="text-muted-foreground">Review bill details before completion.</p>
          </div>
        </div>
        <Badge variant={sessionStatus === "active" ? "default" : "secondary"}>
          {sessionStatus}
        </Badge>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Session Details</CardTitle>
              <CardDescription>Session ID: {sessionId}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Lines</p>
                <p className="text-lg font-semibold">{totals.lines}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Quantity</p>
                <p className="text-lg font-semibold">{totals.qty}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Grand Total</p>
                <p className="text-lg font-semibold">{formatCurrency(totals.total)}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Bill Items</CardTitle>
              <CardDescription>
                Add or remove products before completing the bill.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <LiveSessionBillEditor
                sessionId={sessionId}
                editable={sessionStatus === "active"}
              />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Customer (Optional)</CardTitle>
              <CardDescription>Search by phone and attach customer to bill.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="customerPhone">Customer Phone</Label>
                <div className="flex gap-2">
                  <Input
                    id="customerPhone"
                    type="tel"
                    placeholder="e.g., 9876543210"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                  />
                  <Button variant="outline" size="icon" onClick={handleSearchCustomer}>
                    <Search className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {customersLoading ? (
                <Skeleton className="h-14 w-full" />
              ) : selectedCustomer ? (
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Attached Customer</p>
                  <p className="font-semibold mt-1">{selectedCustomer.name}</p>
                  <p className="text-sm text-muted-foreground">{selectedCustomer.phone}</p>
                </div>
              ) : normalizedPhone ? (
                <div className="rounded-lg border border-dashed p-3">
                  <p className="text-sm text-muted-foreground">
                    No customer found with this phone number.
                  </p>
                  <Button className="mt-3 w-full" variant="outline" onClick={handleAddCustomer}>
                    <UserRound className="mr-2 h-4 w-4" />
                    Add New Customer
                  </Button>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Enter a phone number to search customer.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Bill Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button
                className="w-full"
                onClick={handleCompleteBill}
                disabled={actionLoading || sessionStatus !== "active"}
              >
                {actionLoading ? "Processing..." : "Complete Bill"}
              </Button>
              <Button
                className="w-full"
                variant="outline"
                onClick={handleCancelBill}
                disabled={actionLoading || sessionStatus !== "active"}
              >
                Cancel Bill
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

