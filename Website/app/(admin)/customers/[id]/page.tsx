"use client"

import { use, useState } from "react"
import Link from "next/link"
import { format } from "date-fns"
import { ArrowLeft, Phone, Mail, MapPin, Pencil, Plus, CreditCard, Receipt } from "lucide-react"
import { useCustomers, useLedger, useSales } from "@/hooks/use-firestore"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { AddPaymentDialog } from "@/components/customers/add-payment-dialog"

export default function CustomerProfilePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const { customers, loading: customersLoading, updateCustomer } = useCustomers()
  const { entries: ledgerEntries, loading: ledgerLoading, addEntry } = useLedger(id)
  const { sales, loading: salesLoading } = useSales()
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false)

  const customer = customers.find((c) => c.id === id)
  const customerSales = sales.filter((s) => s.customerId === id)

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount)
  }

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2)
  }

  const handleAddPayment = async (amount: number, notes: string) => {
    if (!customer) return

    await addEntry({
      customerId: id,
      type: "payment",
      amount,
      notes,
    })

    await updateCustomer(id, {
      balance: Math.max(0, customer.balance - amount),
    })
  }

  if (customersLoading || ledgerLoading || salesLoading) {
    return <ProfileSkeleton />
  }

  if (!customer) {
    return (
      <div className="flex flex-col items-center justify-center h-96 space-y-4">
        <p className="text-muted-foreground">Customer not found</p>
        <Button asChild>
          <Link href="/customers">Back to Customers</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/customers">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-semibold tracking-tight">Customer Profile</h1>
          <p className="text-muted-foreground">View customer details and history</p>
        </div>
        <Button variant="outline" asChild>
          <Link href={`/customers/edit/${customer.id}`}>
            <Pencil className="mr-2 h-4 w-4" />
            Edit
          </Link>
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Profile Card */}
        <Card className="lg:col-span-1">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center text-center">
              <Avatar className="h-20 w-20 mb-4">
                <AvatarFallback className="bg-primary text-primary-foreground text-xl">
                  {getInitials(customer.name)}
                </AvatarFallback>
              </Avatar>
              <h2 className="text-xl font-semibold">{customer.name}</h2>
              <Badge variant={customer.balance > 0 ? "destructive" : "secondary"} className="mt-2">
                {customer.balance > 0 ? "Credit Due" : "Clear"}
              </Badge>

              <div className="mt-6 w-full space-y-3 text-left">
                <div className="flex items-center gap-3">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{customer.phone}</span>
                </div>
                {customer.email && (
                  <div className="flex items-center gap-3">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{customer.email}</span>
                  </div>
                )}
                {customer.address && (
                  <div className="flex items-start gap-3">
                    <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <span className="text-sm">{customer.address}</span>
                  </div>
                )}
              </div>

              <div className="mt-6 w-full grid grid-cols-2 gap-4">
                <div className="rounded-lg bg-muted p-3 text-center">
                  <p className="text-xs text-muted-foreground">Total Purchases</p>
                  <p className="text-lg font-semibold">{formatCurrency(customer.totalPurchases)}</p>
                </div>
                <div className="rounded-lg bg-muted p-3 text-center">
                  <p className="text-xs text-muted-foreground">Credit Balance</p>
                  <p className={`text-lg font-semibold ${customer.balance > 0 ? "text-destructive" : ""}`}>
                    {formatCurrency(customer.balance)}
                  </p>
                </div>
              </div>

              {customer.balance > 0 && (
                <Button className="mt-4 w-full" onClick={() => setPaymentDialogOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Record Payment
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* History Tabs */}
        <Card className="lg:col-span-2">
          <Tabs defaultValue="purchases">
            <CardHeader>
              <TabsList>
                <TabsTrigger value="purchases" className="flex items-center gap-2">
                  <Receipt className="h-4 w-4" />
                  Purchases
                </TabsTrigger>
                <TabsTrigger value="ledger" className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4" />
                  Ledger
                </TabsTrigger>
              </TabsList>
            </CardHeader>
            <CardContent>
              <TabsContent value="purchases" className="mt-0">
                {customerSales.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <Receipt className="h-12 w-12 text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">No purchases yet</p>
                  </div>
                ) : (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Bill No</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                          <TableHead>Payment</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {customerSales.slice(0, 10).map((sale) => (
                          <TableRow key={sale.id}>
                            <TableCell className="font-medium">{sale.billNo}</TableCell>
                            <TableCell>{format(sale.createdAt, "MMM dd, yyyy")}</TableCell>
                            <TableCell className="text-right">{formatCurrency(sale.total)}</TableCell>
                            <TableCell>
                              <Badge variant={sale.paymentMethod === "credit" ? "destructive" : "secondary"}>
                                {sale.paymentMethod.toUpperCase()}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="ledger" className="mt-0">
                {ledgerEntries.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <CreditCard className="h-12 w-12 text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">No ledger entries</p>
                  </div>
                ) : (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                          <TableHead>Notes</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {ledgerEntries.map((entry) => (
                          <TableRow key={entry.id}>
                            <TableCell>{format(entry.createdAt, "MMM dd, yyyy")}</TableCell>
                            <TableCell>
                              <Badge variant={entry.type === "credit" ? "destructive" : "default"}>
                                {entry.type === "credit" ? "Credit" : "Payment"}
                              </Badge>
                            </TableCell>
                            <TableCell className={`text-right font-medium ${entry.type === "payment" ? "text-green-600" : "text-destructive"}`}>
                              {entry.type === "payment" ? "+" : "-"}{formatCurrency(entry.amount)}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {entry.notes || "-"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </TabsContent>
            </CardContent>
          </Tabs>
        </Card>
      </div>

      <AddPaymentDialog
        open={paymentDialogOpen}
        onOpenChange={setPaymentDialogOpen}
        customer={customer}
        onSubmit={handleAddPayment}
      />
    </div>
  )
}

function ProfileSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-48" />
      <div className="grid gap-6 lg:grid-cols-3">
        <Skeleton className="h-96" />
        <Skeleton className="h-96 lg:col-span-2" />
      </div>
    </div>
  )
}
