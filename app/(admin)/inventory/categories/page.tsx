"use client"

import { useCategories, useProducts } from "@/hooks/use-firestore"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Package } from "lucide-react"

export default function CategoriesPage() {
  const { categories, loading } = useCategories()
  const { products } = useProducts()

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-4 w-48 mt-2" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    )
  }

  const getCategoryValue = (categoryName: string) => {
    const categoryProducts = products.filter((p) => p.category === categoryName)
    return categoryProducts.reduce((sum, p) => sum + p.price * p.stock, 0)
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Categories</h1>
        <p className="text-muted-foreground">
          View products organized by category
        </p>
      </div>

      {categories.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Package className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No categories found</p>
            <p className="text-sm text-muted-foreground">
              Add products to create categories
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {categories.map((category) => {
            const value = getCategoryValue(category.name)
            return (
              <Card key={category.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{category.name}</CardTitle>
                    <Badge variant="secondary">{category.productCount} items</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <CardDescription>
                    Stock Value: {formatCurrency(value)}
                  </CardDescription>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
