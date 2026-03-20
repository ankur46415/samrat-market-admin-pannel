"use client"

import { format } from "date-fns"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import type { Sale } from "@/lib/types"
import { cn } from "@/lib/utils"

interface RecentSalesProps {
  sales: Sale[]
  className?: string
}

export function RecentSales({ sales, className }: RecentSalesProps) {
  const recentSales = sales.slice(0, 10)

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

  if (recentSales.length === 0) {
    return (
      <Card className={cn(className)}>
        <CardHeader>
          <CardTitle>Recent Sales</CardTitle>
          <CardDescription>Latest transactions</CardDescription>
        </CardHeader>
        <CardContent className="flex h-[280px] items-center justify-center">
          <p className="text-muted-foreground">No sales recorded yet</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={cn(className)}>
      <CardHeader>
        <CardTitle>Recent Sales</CardTitle>
        <CardDescription>Latest {recentSales.length} transactions</CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[320px] pr-4">
          <div className="space-y-4">
            {recentSales.map((sale) => (
              <div
                key={sale.id}
                className="flex items-center justify-between rounded-lg border p-3"
              >
                <div className="space-y-1">
                  <p className="text-sm font-medium leading-none">
                    {sale.billNo}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {sale.customerName || "Walk-in Customer"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {format(sale.createdAt, "MMM dd, h:mm a")}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="font-semibold">{formatCurrency(sale.total)}</span>
                  <Badge variant={getPaymentBadge(sale.paymentMethod)}>
                    {sale.paymentMethod.toUpperCase()}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
