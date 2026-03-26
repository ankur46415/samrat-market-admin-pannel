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
      <Card className={cn(className, "border-chart-3/30")}>
        <CardHeader className="pb-6">
          <CardTitle className="text-xl">Recent Sales</CardTitle>
          <CardDescription className="text-sm">Latest transactions</CardDescription>
        </CardHeader>
        <CardContent className="flex h-[320px] items-center justify-center">
          <p className="text-muted-foreground">No sales recorded yet</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={cn(className, "border-chart-3/30 hover:border-chart-3/50 transition-colors")}>
      <CardHeader className="pb-6">
        <CardTitle className="text-xl">Recent Sales</CardTitle>
        <CardDescription className="text-sm">Latest {recentSales.length} transactions</CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[340px] pr-4">
          <div className="space-y-3">
            {recentSales.map((sale, index) => (
              <div
                key={sale.id}
                className="flex items-center justify-between rounded-lg border border-muted/40 bg-muted/20 hover:bg-muted/40 hover:border-muted/60 p-4 transition-all duration-200"
              >
                <div className="space-y-1 flex-1 min-w-0">
                  <p className="text-sm font-semibold leading-none text-foreground">
                    {sale.billNo}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {sale.customerName || "Walk-in Customer"}
                  </p>
                  <p className="text-xs text-muted-foreground/70">
                    {format(sale.createdAt, "MMM dd, h:mm a")}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2 flex-shrink-0 ml-4">
                  <span className="font-bold text-sm text-chart-3">{formatCurrency(sale.total)}</span>
                  <Badge variant={getPaymentBadge(sale.paymentMethod)} className="text-xs">
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
