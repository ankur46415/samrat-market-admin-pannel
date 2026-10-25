"use client"

import Link from "next/link"
import { IndianRupee, Pencil, CheckCircle } from "lucide-react"
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { isMissingProductCost } from "@/lib/stock"

export default function MissingCostPage() {
  const { products, loading } = useProducts()

  const missingCostProducts = products
    .filter((p) => isMissingProductCost(p))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }))

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount)

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-72 mt-2" />
        <Skeleton className="h-[400px]" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <IndianRupee className="h-6 w-6 text-amber-600" />
          Missing cost price
        </h1>
        <p className="text-muted-foreground">
          Products with cost ₹0 or not filled — add cost for accurate profit
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            {missingCostProducts.length === 0 ? (
              <span className="flex items-center gap-2 text-green-600">
                <CheckCircle className="h-5 w-5" />
                All products have cost price
              </span>
            ) : (
              `${missingCostProducts.length} product${missingCostProducts.length === 1 ? "" : "s"} need cost`
            )}
          </CardTitle>
          <CardDescription>
            {missingCostProducts.length === 0
              ? "Profit reports will use actual cost for every item."
              : "Edit each product and set cost price in product details."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {missingCostProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <CheckCircle className="h-16 w-16 text-green-500 mb-4" />
              <p className="text-lg font-medium">No missing costs</p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Selling price</TableHead>
                    <TableHead className="text-right">Cost price</TableHead>
                    <TableHead className="text-right">Stock</TableHead>
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {missingCostProducts.map((product) => (
                    <TableRow key={product.id}>
                      <TableCell>
                        <div className="font-medium">{product.name}</div>
                        {product.barcode ? (
                          <div className="text-xs font-mono text-muted-foreground">{product.barcode}</div>
                        ) : null}
                      </TableCell>
                      <TableCell>{product.category || "—"}</TableCell>
                      <TableCell className="text-right">{formatCurrency(product.price)}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant="outline" className="border-amber-500/50 text-amber-700 dark:text-amber-400">
                          ₹0 / missing
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {product.stock} {product.unit}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" asChild title="Edit product">
                          <Link href={`/inventory/edit/${product.id}`}>
                            <Pencil className="h-4 w-4" />
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
