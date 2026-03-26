"use client"

import Link from "next/link"
import { AlertTriangle, ArrowRight, CheckCircle } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Progress } from "@/components/ui/progress"
import type { Product } from "@/lib/types"
import { cn } from "@/lib/utils"
import { isLowStockProduct, minStockDisplayDenominator } from "@/lib/stock"

interface LowStockAlertProps {
  products: Product[]
  className?: string
}

export function LowStockAlert({ products, className }: LowStockAlertProps) {
  const lowStockProducts = products
    .filter((p) => isLowStockProduct(p))
    .sort((a, b) => a.stock - b.stock)
    .slice(0, 8)

  if (lowStockProducts.length === 0) {
    return (
      <Card className={cn(className, "border-success/30 bg-gradient-to-br from-card via-card to-success/5")}>
        <CardHeader className="pb-6">
          <CardTitle className="flex items-center gap-2 text-xl">
            <CheckCircle className="h-5 w-5 text-success" />
            Stock Status
          </CardTitle>
          <CardDescription className="text-sm">All products are well stocked</CardDescription>
        </CardHeader>
        <CardContent className="flex h-[320px] flex-col items-center justify-center text-center">
          <div className="rounded-full bg-success/10 p-4 mb-4">
            <CheckCircle className="h-12 w-12 text-success" />
          </div>
          <p className="text-muted-foreground font-medium">
            Perfect! No products are running low on stock.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={cn(className, "border-destructive/30 hover:border-destructive/50 transition-colors")}>
      <CardHeader className="flex flex-row items-center justify-between pb-6 border-b border-destructive/20">
        <div>
          <CardTitle className="flex items-center gap-2 text-xl">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Low Stock Alert
          </CardTitle>
          <CardDescription className="text-sm">{lowStockProducts.length} products need restocking</CardDescription>
        </div>
        <Button variant="outline" size="sm" asChild className="ml-2 flex-shrink-0">
          <Link href="/inventory/low-stock" className="flex items-center gap-1">
            View All
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="pt-6">
        <ScrollArea className="h-[300px] pr-4">
          <div className="space-y-4">
            {lowStockProducts.map((product) => {
              const denom = minStockDisplayDenominator(product.minStock)
              const stockPercentage = Math.round((product.stock / denom) * 100)
              const isOutOfStock = product.stock === 0
              
              return (
                <div key={product.id} className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 space-y-2 hover:bg-destructive/10 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold leading-none text-foreground">
                        {product.name}
                      </p>
                      <p className="text-xs text-muted-foreground/80">
                        {product.category}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0 ml-2">
                      <span className={cn(
                        "text-sm font-bold",
                        isOutOfStock ? "text-destructive" : "text-warning"
                      )}>
                        {product.stock} {product.unit}
                      </span>
                      <p className="text-xs text-muted-foreground/70">
                        Min: {product.minStock}
                      </p>
                    </div>
                  </div>
                  <Progress
                    value={Math.min(stockPercentage, 100)}
                    className={cn(
                      "h-2",
                      isOutOfStock && "[&>div]:bg-destructive"
                    )}
                  />
                </div>
              )
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
