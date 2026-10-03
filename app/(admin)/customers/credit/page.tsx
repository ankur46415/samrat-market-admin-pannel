"use client"

import Link from "next/link"
import { CreditCard, Eye, CheckCircle } from "lucide-react"
import { useCustomers } from "@/hooks/use-firestore"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"

export default function CreditAccountsPage() {
  const { customers, loading } = useCustomers()

  const creditCustomers = customers
    .filter((c) => c.balance > 0)
    .sort((a, b) => b.balance - a.balance)

  const totalCredit = creditCustomers.reduce((sum, c) => sum + c.balance, 0)

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

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64 mt-2" />
        </div>
        <Skeleton className="h-32" />
        <Skeleton className="h-[400px]" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <CreditCard className="h-6 w-6 text-primary" />
          Credit Accounts (Udhaar)
        </h1>
        <p className="text-muted-foreground">
          Customers with pending credit balances
        </p>
      </div>

      {/* Summary Card */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Total Outstanding</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-destructive">
              {formatCurrency(totalCredit)}
            </span>
            <span className="text-muted-foreground">
              from {creditCustomers.length} customers
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Credit Accounts Table */}
      <Card>
        <CardHeader>
          <CardTitle>
            {creditCustomers.length === 0 ? (
              <span className="flex items-center gap-2 text-green-600">
                <CheckCircle className="h-5 w-5" />
                No Pending Credit
              </span>
            ) : (
              `${creditCustomers.length} Accounts with Credit`
            )}
          </CardTitle>
          <CardDescription>
            {creditCustomers.length === 0
              ? "All customers have cleared their balances"
              : "Sorted by highest balance first"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {creditCustomers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <CheckCircle className="h-16 w-16 text-green-500 mb-4" />
              <p className="text-lg font-medium">No pending credit!</p>
              <p className="text-muted-foreground text-center mt-2">
                All customer accounts are clear.
              </p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead className="text-right">Credit Balance</TableHead>
                    <TableHead className="text-right">Total Purchases</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {creditCustomers.map((customer) => (
                    <TableRow key={customer.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9">
                            <AvatarFallback className="bg-destructive/10 text-destructive text-xs">
                              {getInitials(customer.name)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-medium">{customer.name}</span>
                        </div>
                      </TableCell>
                      <TableCell>{customer.phone}</TableCell>
                      <TableCell className="text-right">
                        <span className="font-semibold text-destructive">
                          {formatCurrency(customer.balance)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(customer.totalPurchases)}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" asChild>
                          <Link href={`/customers/${customer.id}`}>
                            <Eye className="h-4 w-4" />
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
