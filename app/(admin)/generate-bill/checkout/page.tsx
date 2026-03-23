"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
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
  const params = useSearchParams()
  const sessionId = params.get("sessionId") || ""
  const returnedPhone = params.get("customerPhone") || ""

  const { customers, loading: customersLoading } = useCustomers()

  const [sessionStatus, setSessionStatus] = useState<string>("active")
  const [items, setItems] = useState<LiveItem[]>([])
  const [loadingItems, setLoadingItems] = useState(true)
  const [customerPhone, setCustomerPhone] = useState("")
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState(false)

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
      await completeLiveBillingSession(sessionId)
      toast.success("Bill generated successfully")
      router.push("/generate-bill")
    } catch (e) {
      console.error(e)
      toast.error("Failed to generate bill")
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
              <CardTitle>Scanned Items</CardTitle>
              <CardDescription>Live updates from phone scanning session.</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingItems ? (
                <div className="space-y-3">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Product</TableHead>
                        <TableHead className="text-right">Qty</TableHead>
                        <TableHead className="text-right">Price</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="h-20 text-center">
                            No items scanned yet.
                          </TableCell>
                        </TableRow>
                      ) : (
                        items.map((it) => (
                          <TableRow key={it.barcode}>
                            <TableCell className="font-medium">{it.name || it.barcode}</TableCell>
                            <TableCell className="text-right">{it.quantity}</TableCell>
                            <TableCell className="text-right">{formatCurrency(it.price)}</TableCell>
                            <TableCell className="text-right font-medium">
                              {formatCurrency(it.quantity * it.price)}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
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
              ) : matchedCustomer ? (
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Attached Customer</p>
                  <p className="font-semibold mt-1">{matchedCustomer.name}</p>
                  <p className="text-sm text-muted-foreground">{matchedCustomer.phone}</p>
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

