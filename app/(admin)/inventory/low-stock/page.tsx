"use client"

import Link from "next/link"
import { AlertTriangle, Pencil, CheckCircle } from "lucide-react"
import { useProducts } from "@/hooks/use-firestore"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

export default function LowStockPage() {
  const { products, loading } = useProducts()

  const lowStockProducts = products
    .filter((p) => p.stock <= (p.minStock || 10))
    .sort((a, b) => a.stock - b.stock)

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount)
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64 mt-2" />
        </div>
        <Skeleton className="h-[400px]" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <AlertTriangle className="h-6 w-6 text-destructive" />
          Low Stock Alert
        </h1>
        <p className="text-muted-foreground">
          Products that need restocking
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            {lowStockProducts.length === 0 ? (
              <span className="flex items-center gap-2 text-green-600">
                <CheckCircle className="h-5 w-5" />
                All Products Stocked
              </span>
            ) : (
              `${lowStockProducts.length} Products Need Attention`
            )}
          </CardTitle>
          <CardDescription>
            {lowStockProducts.length === 0
              ? "Great! All your products are well stocked."
              : "These products are at or below minimum stock levels"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {lowStockProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <CheckCircle className="h-16 w-16 text-green-500 mb-4" />
              <p className="text-lg font-medium">Everything looks good!</p>
              <p className="text-muted-foreground text-center mt-2">
                All products have sufficient stock levels.
              </p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Current Stock</TableHead>
                    <TableHead className="text-right">Min Stock</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Restock Cost</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lowStockProducts.map((product) => {
                    const stockPercentage = Math.round(
                      (product.stock / (product.minStock || 10)) * 100
                    )
                    const isOutOfStock = product.stock === 0
                    const restockAmount = (product.minStock || 10) - product.stock
                    const restockCost = restockAmount * product.costPrice

                    return (
                      <TableRow key={product.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{product.name}</p>
                            {product.barcode && (
                              <p className="text-xs text-muted-foreground">
                                {product.barcode}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{product.category}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex flex-col items-end gap-1">
                            <span className={isOutOfStock ? "text-destructive font-medium" : ""}>
                              {product.stock} {product.unit}
                            </span>
                            <Progress
                              value={Math.min(stockPercentage, 100)}
                              className="h-1.5 w-16"
                            />
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          {product.minStock || 10} {product.unit}
                        </TableCell>
                        <TableCell>
                          {isOutOfStock ? (
                            <Badge variant="destructive">Out of Stock</Badge>
                          ) : (
                            <Badge variant="outline" className="border-warning text-warning">
                              Low Stock
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="text-sm">
                            <p>{formatCurrency(restockCost)}</p>
                            <p className="text-xs text-muted-foreground">
                              for {restockAmount} {product.unit}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" asChild>
                            <Link href={`/inventory/edit/${product.id}`}>
                              <Pencil className="h-4 w-4" />
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
