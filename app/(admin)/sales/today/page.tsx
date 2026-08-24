"use client"

import { useMemo, useState } from "react"
import { format, isToday } from "date-fns"
import { TrendingUp, Receipt, CreditCard, Banknote, Smartphone, Search } from "lucide-react"
import { useSales } from "@/hooks/use-firestore"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
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
import { saleMatchesPhoneFilter, saleMatchesSearch, salePhone } from "@/lib/sales-filter"

export default function TodaySalesPage() {
  const { sales, loading } = useSales()
  const [search, setSearch] = useState("")
  const [phoneFilter, setPhoneFilter] = useState("")

  const todaySales = useMemo(() => {
    return sales.filter((sale) => isToday(sale.createdAt))
  }, [sales])

  const filteredTodaySales = useMemo(() => {
    return todaySales.filter(
      (sale) => saleMatchesSearch(sale, search) && saleMatchesPhoneFilter(sale, phoneFilter)
    )
  }, [todaySales, search, phoneFilter])

  const stats = useMemo(() => {
    const total = filteredTodaySales.reduce((sum, s) => sum + s.total, 0)
    const cash = filteredTodaySales
      .filter((s) => s.paymentMethod === "cash")
      .reduce((sum, s) => sum + s.total, 0)
    const upi = filteredTodaySales
      .filter((s) => s.paymentMethod === "upi")
      .reduce((sum, s) => sum + s.total, 0)
    const card = filteredTodaySales
      .filter((s) => s.paymentMethod === "card")
      .reduce((sum, s) => sum + s.total, 0)
    const credit = filteredTodaySales
      .filter((s) => s.paymentMethod === "credit")
      .reduce((sum, s) => sum + s.total, 0)

    return { total, cash, upi, card, credit, count: filteredTodaySales.length }
  }, [filteredTodaySales])

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount)
  }

  const getPaymentBadge = (method: string) => {
    const variants: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
      cash: "default",
      upi: "secondary",
      card: "outline",
      credit: "destructive",
    }
    return variants[method] || "default"
  }

  if (loading) {
    return <TodaySkeleton />
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <TrendingUp className="h-6 w-6 text-primary" />
          Today&apos;s Sales
        </h1>
        <p className="text-muted-foreground">
          {format(new Date(), "EEEE, MMMM dd, yyyy")}
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card className="lg:col-span-1">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Revenue
              </CardTitle>
              <Receipt className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.total)}</div>
            <p className="text-xs text-muted-foreground">{stats.count} transactions</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Cash
              </CardTitle>
              <Banknote className="h-4 w-4 text-green-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.cash)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                UPI
              </CardTitle>
              <Smartphone className="h-4 w-4 text-purple-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.upi)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Card
              </CardTitle>
              <CreditCard className="h-4 w-4 text-blue-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.card)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Credit (Udhaar)
              </CardTitle>
              <Receipt className="h-4 w-4 text-destructive" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              {formatCurrency(stats.credit)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Transactions Table */}
      <Card>
        <CardHeader>
          <CardTitle>Today&apos;s Transactions</CardTitle>
          <CardDescription>
            {filteredTodaySales.length === 0
              ? "No sales match your filters today"
              : `${filteredTodaySales.length} of ${todaySales.length} sales today`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <div className="relative min-w-[200px] flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search bill or customer..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8"
              />
            </div>
            <Input
              type="tel"
              inputMode="numeric"
              placeholder="Filter by phone"
              value={phoneFilter}
              onChange={(e) => setPhoneFilter(e.target.value.replace(/\D/g, "").slice(0, 10))}
              className="w-full font-mono sm:w-52"
            />
          </div>
          {filteredTodaySales.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Receipt className="h-16 w-16 text-muted-foreground mb-4" />
              <p className="text-lg font-medium">
                {todaySales.length === 0 ? "No sales today" : "No matching sales"}
              </p>
              <p className="text-muted-foreground">
                {todaySales.length === 0
                  ? "Sales will appear here as they are recorded"
                  : "Try clearing the phone or search filter"}
              </p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>Bill No</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Items</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Payment</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTodaySales.map((sale) => (
                    <TableRow key={sale.id}>
                      <TableCell className="font-medium">
                        {format(sale.createdAt, "h:mm a")}
                      </TableCell>
                      <TableCell>{sale.billNo}</TableCell>
                      <TableCell>{sale.customerName || "Walk-in"}</TableCell>
                      <TableCell className="font-mono text-sm">{salePhone(sale)}</TableCell>
                      <TableCell>
                        <span className="text-muted-foreground">
                          {sale.items.length} item{sale.items.length > 1 ? "s" : ""}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {formatCurrency(sale.total)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={getPaymentBadge(sale.paymentMethod)}>
                          {sale.paymentMethod.toUpperCase()}
                        </Badge>
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

function TodaySkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-4 w-48 mt-2" />
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
      <Skeleton className="h-[400px]" />
    </div>
  )
}
