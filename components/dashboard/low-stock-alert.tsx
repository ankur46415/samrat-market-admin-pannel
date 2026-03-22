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
      <Card className={cn(className)}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-500" />
            Stock Status
          </CardTitle>
          <CardDescription>All products are well stocked</CardDescription>
        </CardHeader>
        <CardContent className="flex h-[280px] flex-col items-center justify-center text-center">
          <CheckCircle className="h-12 w-12 text-green-500 mb-3" />
          <p className="text-muted-foreground">
            Great! No products are running low on stock.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={cn(className)}>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Low Stock Alert
          </CardTitle>
          <CardDescription>{lowStockProducts.length} products need restocking</CardDescription>
        </div>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/inventory/low-stock">
            View All
            <ArrowRight className="ml-1 h-4 w-4" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[280px] pr-4">
          <div className="space-y-4">
            {lowStockProducts.map((product) => {
              const denom = minStockDisplayDenominator(product.minStock)
              const stockPercentage = Math.round((product.stock / denom) * 100)
              const isOutOfStock = product.stock === 0
              
              return (
                <div key={product.id} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium leading-none">
                        {product.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {product.category}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className={cn(
                        "text-sm font-semibold",
                        isOutOfStock ? "text-destructive" : "text-warning"
                      )}>
                        {product.stock} {product.unit}
                      </span>
                      <p className="text-xs text-muted-foreground">
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
