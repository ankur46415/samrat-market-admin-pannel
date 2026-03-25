"use client"

import { useState, useEffect, use } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Layers, Package, Box } from "lucide-react"
import { format, differenceInCalendarDays, startOfDay } from "date-fns"
import { useProducts, useCategories } from "@/hooks/use-firestore"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { toast } from "sonner"
import { normalizeProductUnit, parseMinStockInput } from "@/lib/stock"
import type { Product } from "@/lib/types"
import { RACK_OPTIONS, RACK_OPTIONS_SET } from "@/lib/rack-options"
import {
  inventoryTableFrameClassName,
  invTableHeadClass,
  invTableCellClass,
  invTableCellNumeric,
} from "@/lib/inventory-ui"
import { cn } from "@/lib/utils"

const labelClass = "text-sm font-medium text-foreground"
const inputClass = "h-11 rounded-lg border-border/80 shadow-sm"

function batchExpiryPill(expiry: Date) {
  const d = differenceInCalendarDays(startOfDay(expiry), startOfDay(new Date()))
  if (d < 0) return <Badge variant="destructive" className="font-normal">Expired</Badge>
  if (d <= 7) return <Badge variant="outline" className="border-amber-500/40 bg-amber-500/5 text-amber-900 dark:text-amber-100">≤7d</Badge>
  return null
}

export default function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const router = useRouter()
  const { products, loading: productsLoading, updateProduct } = useProducts()
  const { categories } = useCategories()
  const [saving, setSaving] = useState(false)
  const [newCategory, setNewCategory] = useState("")
  const [showNewCategory, setShowNewCategory] = useState(false)

  const [formData, setFormData] = useState({
    name: "",
    category: "",
    rack: "",
    price: "",
    costPrice: "",
    unit: "pcs",
    barcode: "",
    brand: "",
    expiry: "",
    minStock: "10",
  })

  const product = products.find((p) => p.id === id)

  useEffect(() => {
    if (product) {
      setFormData({
        name: product.name || "",
        category: product.category || "",
        rack: product.rack || "",
        price: product.price?.toString() || "0",
        costPrice: product.costPrice?.toString() || "0",
        unit: product.unit || "pcs",
        barcode: product.barcode || "",
        brand: product.brand || "",
        expiry: product.expiry || "",
        minStock: String(product.minStock),
      })
    }
  }, [product])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.name || !formData.price || !formData.costPrice) {
      toast.error("Please fill in all required fields")
      return
    }

    const category = showNewCategory ? newCategory : formData.category

    if (!category) {
      toast.error("Please select or enter a category")
      return
    }

    if (!formData.rack || !RACK_OPTIONS_SET.has(formData.rack as (typeof RACK_OPTIONS)[number])) {
      toast.error("Select rack")
      return
    }

    setSaving(true)

    try {
      const updatePayload: Record<string, unknown> = {
        name: formData.name,
        category,
        rack: formData.rack,
        price: parseFloat(formData.price),
        costPrice: parseFloat(formData.costPrice),
        unit: normalizeProductUnit(formData.unit),
        minStock: parseMinStockInput(formData.minStock, 10),
      }

      if (formData.barcode) {
        updatePayload.barcode = formData.barcode
      }
      if (formData.brand) {
        updatePayload.brand = formData.brand
      }
      if (formData.expiry) {
        updatePayload.expiry = formData.expiry
      }

      await updateProduct(id, updatePayload as Partial<Product>)

      toast.success("Product updated successfully")
      router.push("/inventory")
    } catch (error) {
      console.error("Error updating product:", error)
      toast.error("Failed to update product")
    } finally {
      setSaving(false)
    }
  }

  if (productsLoading) {
    return (
      <div className="mx-auto max-w-4xl space-y-6 pb-10">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-32 rounded-xl" />
        <Skeleton className="h-[480px] rounded-xl" />
      </div>
    )
  }

  if (!product) {
    return (
      <div className="mx-auto flex max-w-lg flex-col items-center justify-center gap-4 rounded-2xl border border-dashed py-20 text-center">
        <Box className="h-12 w-12 text-muted-foreground" />
        <p className="text-muted-foreground">Product not found</p>
        <Button asChild>
          <Link href="/inventory">Back to inventory</Link>
        </Button>
      </div>
    )
  }

  const batchCount = product.batches.length
  const totalFromBatches = product.batches.reduce((s, b) => s + b.quantity, 0)

  return (
    <div className="mx-auto max-w-4xl space-y-8 pb-12">
      <div className="flex items-start gap-4">
        <Button variant="ghost" size="icon" className="mt-0.5 shrink-0 rounded-lg" asChild>
          <Link href="/inventory">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">Edit product</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">{product.name}</h1>
            {product.barcode ? (
              <p className="mt-1 font-mono text-sm text-muted-foreground">{product.barcode}</p>
            ) : null}
          </div>
          <div className="grid grid-cols-2 gap-3 max-w-md">
            <div className="rounded-xl border border-border/70 bg-muted/20 p-3 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Batches</p>
              <p className="mt-1 text-xl font-semibold tabular-nums">{batchCount}</p>
            </div>
            <div className="rounded-xl border border-border/70 bg-muted/20 p-3 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Total qty</p>
              <p className="mt-1 text-xl font-semibold tabular-nums">
                {totalFromBatches} <span className="text-sm font-normal text-muted-foreground">{product.unit}</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <Tabs defaultValue="details" className="w-full">
          <TabsList className="mb-6 grid h-auto w-full grid-cols-2 gap-1 rounded-xl bg-muted/60 p-1.5 sm:inline-flex sm:w-auto">
            <TabsTrigger
              value="details"
              className="gap-2 rounded-lg px-4 py-2.5 data-[state=active]:bg-background data-[state=active]:shadow-sm"
            >
              <Package className="h-4 w-4 opacity-80" />
              Product details
            </TabsTrigger>
            <TabsTrigger
              value="batches"
              className="gap-2 rounded-lg px-4 py-2.5 data-[state=active]:bg-background data-[state=active]:shadow-sm"
            >
              <Layers className="h-4 w-4 opacity-80" />
              Stock batches
              {batchCount > 0 ? (
                <span className="ml-1 rounded-md bg-primary/10 px-1.5 py-0.5 text-xs font-semibold text-primary">
                  {batchCount}
                </span>
              ) : null}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="mt-0 focus-visible:outline-none">
            <Card className="border-border/80 shadow-md shadow-black/5">
              <CardHeader className="border-b border-border/60 bg-muted/20">
                <CardTitle className="text-lg">Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-8 pt-6">
                <div className="grid gap-6 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="name" className={labelClass}>
                      Product name *
                    </Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className={inputClass}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="barcode" className={labelClass}>
                      Barcode
                    </Label>
                    <Input
                      id="barcode"
                      value={formData.barcode}
                      onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                      className={cn(inputClass, "font-mono")}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="brand" className={labelClass}>
                      Brand <span className="font-normal text-muted-foreground">(optional)</span>
                    </Label>
                    <Input
                      id="brand"
                      value={formData.brand}
                      onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                      className={inputClass}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="expiry" className={labelClass}>
                      Expiry <span className="font-normal text-muted-foreground">(optional)</span>
                    </Label>
                    <Input
                      id="expiry"
                      type="date"
                      value={formData.expiry}
                      onChange={(e) => setFormData({ ...formData, expiry: e.target.value })}
                      className={inputClass}
                    />
                  </div>
                </div>

                <Separator />

                <div className="grid gap-6 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="category" className={labelClass}>
                      Category *
                    </Label>
                    {showNewCategory ? (
                      <div className="flex gap-2">
                        <Input
                          value={newCategory}
                          onChange={(e) => setNewCategory(e.target.value)}
                          className={inputClass}
                          placeholder="New category"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          className="rounded-lg"
                          onClick={() => {
                            setShowNewCategory(false)
                            setNewCategory("")
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <Select
                        value={formData.category}
                        onValueChange={(value: string) => {
                          if (value === "new") {
                            setShowNewCategory(true)
                          } else {
                            setFormData({ ...formData, category: value })
                          }
                        }}
                      >
                        <SelectTrigger className={cn(inputClass, "w-full")}>
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                        <SelectContent>
                          {categories
                            .map((cat) => (cat.name ?? "").trim())
                            .filter((name) => name.length > 0)
                            .map((name) => (
                              <SelectItem key={name} value={name}>
                                {name}
                              </SelectItem>
                            ))}
                          <SelectItem value="new">+ Add new category</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="rack" className={labelClass}>
                      Rack *
                    </Label>
                    <Select
                      value={formData.rack || ""}
                      onValueChange={(value: string) => setFormData({ ...formData, rack: value })}
                    >
                      <SelectTrigger className={cn(inputClass, "w-full")}>
                        <SelectValue placeholder="Select rack" />
                      </SelectTrigger>
                      <SelectContent>
                        {RACK_OPTIONS.map((opt) => (
                          <SelectItem key={opt} value={opt}>
                            {opt}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="unit" className={labelClass}>
                      Unit
                    </Label>
                    <Select
                      value={formData.unit || "pcs"}
                      onValueChange={(value: string) => setFormData({ ...formData, unit: value })}
                    >
                      <SelectTrigger className={cn(inputClass, "w-full")}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pcs">Pieces (pcs)</SelectItem>
                        <SelectItem value="kg">Kilograms (kg)</SelectItem>
                        <SelectItem value="g">Grams (g)</SelectItem>
                        <SelectItem value="l">Liters (l)</SelectItem>
                        <SelectItem value="ml">Milliliters (ml)</SelectItem>
                        <SelectItem value="pack">Pack</SelectItem>
                        <SelectItem value="box">Box</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="space-y-2">
                    <Label htmlFor="price" className={labelClass}>
                      Selling price (INR) *
                    </Label>
                    <Input
                      id="price"
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.price}
                      onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                      className={cn(inputClass, "tabular-nums")}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="costPrice" className={labelClass}>
                      Cost price (INR) *
                    </Label>
                    <Input
                      id="costPrice"
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.costPrice}
                      onChange={(e) => setFormData({ ...formData, costPrice: e.target.value })}
                      className={cn(inputClass, "tabular-nums")}
                      required
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label className={labelClass}>Total stock</Label>
                    <div className="rounded-lg border border-border/80 bg-muted/30 px-4 py-3 text-sm">
                      <span className="font-semibold tabular-nums">{product.stock}</span> {product.unit}
                      {batchCount > 0 ? (
                        <>
                          {" "}
                          · <span className="font-semibold">{batchCount}</span> batch{batchCount === 1 ? "" : "es"}
                        </>
                      ) : null}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="minStock" className={labelClass}>
                      Minimum stock alert
                    </Label>
                    <Input
                      id="minStock"
                      type="number"
                      min="0"
                      value={formData.minStock}
                      onChange={(e) => setFormData({ ...formData, minStock: e.target.value })}
                      className={cn(inputClass, "tabular-nums")}
                    />
                  </div>
                </div>

                <div className="flex flex-wrap gap-3 border-t border-border/60 pt-6">
                  <Button type="submit" disabled={saving} size="lg" className="rounded-lg shadow-sm">
                    {saving ? "Saving…" : "Save changes"}
                  </Button>
                  <Button type="button" variant="outline" className="rounded-lg" asChild>
                    <Link href="/inventory">Cancel</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="batches" className="mt-0 focus-visible:outline-none">
            <Card className="border-border/80 shadow-md shadow-black/5">
              <CardHeader className="border-b border-border/60 bg-muted/20">
                <CardTitle className="text-lg">Batches</CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                {product.batches.length === 0 ? (
                  <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed py-14 text-center">
                    <Layers className="h-10 w-10 text-muted-foreground/70" />
                    <p className="font-medium text-foreground">No batches yet</p>
                    <Button asChild variant="outline" size="sm">
                      <Link href="/inventory/add">Add stock</Link>
                    </Button>
                  </div>
                ) : (
                  <div className={inventoryTableFrameClassName()}>
                    <Table>
                      <TableHeader>
                        <TableRow className="border-b-0 hover:bg-transparent">
                          <TableHead className={invTableHeadClass}>Batch</TableHead>
                          <TableHead className={invTableHeadClass}>Expiry</TableHead>
                          <TableHead className={cn(invTableHeadClass, "text-right")}>Qty</TableHead>
                          <TableHead className={cn(invTableHeadClass, "hidden sm:table-cell text-muted-foreground")}>
                            Created
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {product.batches.map((b) => (
                          <TableRow key={b.id} className="border-border/50 hover:bg-muted/40">
                            <TableCell className={cn(invTableCellClass, "max-w-[200px]")}>
                              <code className="block break-all rounded-md bg-muted px-2 py-1.5 font-mono text-[11px] leading-snug">
                                {b.id}
                              </code>
                            </TableCell>
                            <TableCell className={invTableCellClass}>
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-semibold tabular-nums">
                                  {format(b.expiryDate, "dd MMM yyyy")}
                                </span>
                                {batchExpiryPill(b.expiryDate)}
                              </div>
                            </TableCell>
                            <TableCell className={invTableCellNumeric}>
                              <span className="font-semibold">{b.quantity}</span>{" "}
                              <span className="text-muted-foreground">{product.unit}</span>
                            </TableCell>
                            <TableCell
                              className={cn(
                                invTableCellClass,
                                "hidden sm:table-cell text-xs text-muted-foreground"
                              )}
                            >
                              {format(b.createdAt, "dd MMM yyyy · HH:mm")}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}

                <div className="mt-6 flex flex-wrap gap-3 border-t border-border/60 pt-6">
                  <Button type="submit" disabled={saving} className="rounded-lg">
                    {saving ? "Saving…" : "Save product details"}
                  </Button>
                  <Button type="button" variant="outline" className="rounded-lg" asChild>
                    <Link href="/inventory">Back</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </form>
    </div>
  )
}
