"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Package, Layers } from "lucide-react"
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import { toast } from "sonner"
import { normalizeProductUnit, parseMinStockInput } from "@/lib/stock"
import { cn } from "@/lib/utils"
import { RACK_OPTIONS, RACK_OPTIONS_SET } from "@/lib/rack-options"

const labelClass = "text-sm font-medium text-foreground"
const inputClass = "h-11 rounded-lg border-border/80 shadow-sm"
const fieldGroup = "space-y-2"

export default function AddProductPage() {
  const router = useRouter()
  const { addProduct, getProductByBarcode } = useProducts()
  const { categories } = useCategories()
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<"product" | "batch">("product")
  const [newCategory, setNewCategory] = useState("")
  const [showNewCategory, setShowNewCategory] = useState(false)

  const [formData, setFormData] = useState({
    name: "",
    category: "",
    rack: "",
    tag: "",
    status: "",
    price: "",
    costPrice: "",
    stock: "",
    unit: "pcs",
    barcode: "",
    brand: "",
    expiry: "",
    minStock: "10",
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (activeTab !== "batch") {
      setActiveTab("batch")
      toast.info("Fill batch details and then save")
      return
    }

    if (!formData.barcode.trim()) {
      toast.error("Barcode is required")
      return
    }
    if (!formData.rack || !RACK_OPTIONS_SET.has(formData.rack as (typeof RACK_OPTIONS)[number])) {
      toast.error("Select rack")
      return
    }
    if (!formData.expiry) {
      toast.error("Expiry date is required")
      return
    }
    if (!formData.stock || parseInt(formData.stock) <= 0) {
      toast.error("Batch quantity must be greater than 0")
      return
    }
    if (!formData.price || !formData.costPrice) {
      toast.error("Please fill in selling and cost price")
      return
    }

    const category = showNewCategory ? newCategory : formData.category

    if (!category) {
      toast.error("Please select or enter a category")
      return
    }

    setLoading(true)

    try {
      const existing = await getProductByBarcode(formData.barcode)
      await addProduct({
        name: formData.name || "Unnamed Product",
        category,
        rack: formData.rack,
        tag: formData.tag,
        status: formData.status,
        price: parseFloat(formData.price),
        costPrice: parseFloat(formData.costPrice),
        stock: parseInt(formData.stock) || 0,
        unit: normalizeProductUnit(formData.unit),
        barcode: formData.barcode || undefined,
        brand: formData.brand || undefined,
        expiry: formData.expiry || undefined,
        minStock: parseMinStockInput(formData.minStock, 10),
      })
      if (existing) {
        toast.success("Stock added.")
      } else {
        toast.success("Saved.")
      }
      router.push("/inventory")
    } catch (error) {
      console.error("Error adding product:", error)
      toast.error("Failed to save")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full space-y-8 pb-12">
      <div className="flex items-start gap-4">
        <Button variant="ghost" size="icon" className="mt-0.5 shrink-0 rounded-lg" asChild>
          <Link href="/inventory">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="min-w-0 space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">Inventory</p>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Add product & batch</h1>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <Card className="overflow-hidden border-border/80 shadow-lg shadow-black/[0.04]">
          <CardHeader className="space-y-2 border-b border-border/60 bg-muted/25 pb-5">
            <CardTitle className="flex items-center gap-2 text-xl">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Package className="h-5 w-5" />
              </span>
              New entry
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 sm:p-0">
            <Tabs
              value={activeTab}
              onValueChange={(v) => setActiveTab(v as "product" | "batch")}
              className="w-full"
            >
              <div className="border-b border-border/60 bg-muted/20 px-4 pt-4 sm:px-6">
                <TabsList className="grid h-auto w-full grid-cols-2 gap-1 rounded-xl bg-muted/70 p-1.5 sm:max-w-md">
                  <TabsTrigger
                    value="product"
                    className="gap-2 rounded-lg py-2.5 data-[state=active]:bg-background data-[state=active]:shadow-sm"
                  >
                    <Package className="h-4 w-4 shrink-0 opacity-80" />
                    Product & pricing
                  </TabsTrigger>
                  <TabsTrigger
                    value="batch"
                    className="gap-2 rounded-lg py-2.5 data-[state=active]:bg-background data-[state=active]:shadow-sm"
                  >
                    <Layers className="h-4 w-4 shrink-0 opacity-80" />
                    New batch
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="product" className="mt-0 space-y-8 px-4 py-6 sm:px-6 focus-visible:outline-none">
                <div className="grid gap-6 sm:grid-cols-2">
                  <div className={cn(fieldGroup, "sm:col-span-2")}>
                    <Label htmlFor="barcode" className={labelClass}>
                      Barcode <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="barcode"
                      placeholder="e.g. 8901234567890"
                      value={formData.barcode}
                      onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                      className={cn(inputClass, "font-mono text-base")}
                    />
                  </div>

                  <div className={fieldGroup}>
                    <Label htmlFor="name" className={labelClass}>
                      Product name
                    </Label>
                    <Input
                      id="name"
                      placeholder="e.g. Tata Salt 1kg"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className={inputClass}
                    />
                  </div>

                  <div className={fieldGroup}>
                    <Label htmlFor="brand" className={labelClass}>
                      Brand <span className="font-normal text-muted-foreground">(optional)</span>
                    </Label>
                    <Input
                      id="brand"
                      placeholder="e.g. Parle"
                      value={formData.brand}
                      onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                      className={inputClass}
                    />
                  </div>

                  <div className={fieldGroup}>
                    <Label htmlFor="tag" className={labelClass}>
                      Tag
                    </Label>
                    <Input
                      id="tag"
                      placeholder="e.g. Fast Moving"
                      value={formData.tag}
                      onChange={(e) => setFormData({ ...formData, tag: e.target.value })}
                      className={inputClass}
                    />
                  </div>

                  <div className={fieldGroup}>
                    <Label htmlFor="category" className={labelClass}>
                      Category <span className="text-destructive">*</span>
                    </Label>
                    {showNewCategory ? (
                      <div className="flex gap-2">
                        <Input
                          placeholder="New category name"
                          value={newCategory}
                          onChange={(e) => setNewCategory(e.target.value)}
                          className={inputClass}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          className="shrink-0 rounded-lg"
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
                        onValueChange={(value) => {
                          if (value === "new") {
                            setShowNewCategory(true)
                          } else {
                            setFormData({ ...formData, category: value })
                          }
                        }}
                      >
                        <SelectTrigger className={cn(inputClass, "w-full")}>
                          <SelectValue placeholder="Choose category" />
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

                  <div className={fieldGroup}>
                    <Label htmlFor="rack" className={labelClass}>
                      Rack <span className="text-destructive">*</span>
                    </Label>
                    <Select
                      value={formData.rack}
                      onValueChange={(value) => setFormData({ ...formData, rack: value })}
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

                  <div className={fieldGroup}>
                    <Label htmlFor="status" className={labelClass}>
                      Status
                    </Label>
                    <Input
                      id="status"
                      placeholder="e.g. active"
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                      className={inputClass}
                    />
                  </div>

                  <div className={fieldGroup}>
                    <Label htmlFor="unit" className={labelClass}>
                      Unit of measure
                    </Label>
                    <Select
                      value={formData.unit || "pcs"}
                      onValueChange={(value) => setFormData({ ...formData, unit: value })}
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

                  <div className={fieldGroup}>
                    <Label htmlFor="minStock" className={labelClass}>
                      Low-stock alert
                    </Label>
                    <Input
                      id="minStock"
                      type="number"
                      min="0"
                      placeholder="10"
                      value={formData.minStock}
                      onChange={(e) => setFormData({ ...formData, minStock: e.target.value })}
                      className={inputClass}
                    />
                  </div>
                </div>

                <Separator />

                <div>
                  <h3 className="mb-4 text-sm font-semibold text-foreground">Pricing</h3>
                  <div className="grid gap-6 sm:grid-cols-2">
                    <div className={fieldGroup}>
                      <Label htmlFor="price" className={labelClass}>
                        Selling price (INR) <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="price"
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        value={formData.price}
                        onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                        className={cn(inputClass, "tabular-nums")}
                        required
                      />
                    </div>
                    <div className={fieldGroup}>
                      <Label htmlFor="costPrice" className={labelClass}>
                        Cost price (INR) <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="costPrice"
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        value={formData.costPrice}
                        onChange={(e) => setFormData({ ...formData, costPrice: e.target.value })}
                        className={cn(inputClass, "tabular-nums")}
                        required
                      />
                    </div>
                  </div>
                </div>

                <Separator />
                <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <Button type="button" variant="ghost" className="rounded-lg text-muted-foreground" asChild>
                    <Link href="/inventory">Cancel</Link>
                  </Button>
                  <Button
                    type="button"
                    className="rounded-lg px-8 shadow-sm"
                    onClick={() => setActiveTab("batch")}
                  >
                    Next
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="batch" className="mt-0 space-y-6 px-4 py-6 sm:px-6 focus-visible:outline-none">
                <div className="grid max-w-xl gap-6 sm:grid-cols-2">
                  <div className={fieldGroup}>
                    <Label htmlFor="expiry" className={labelClass}>
                      Batch expiry <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="expiry"
                      type="date"
                      value={formData.expiry}
                      onChange={(e) => setFormData({ ...formData, expiry: e.target.value })}
                      className={inputClass}
                      required
                    />
                  </div>

                  <div className={fieldGroup}>
                    <Label htmlFor="stock" className={labelClass}>
                      Quantity in this batch <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="stock"
                      type="number"
                      min="1"
                      placeholder="0"
                      value={formData.stock}
                      onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                      className={cn(inputClass, "tabular-nums")}
                      required
                    />
                  </div>
                </div>

                <Separator />
                <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <Button
                    type="button"
                    variant="ghost"
                    className="rounded-lg text-muted-foreground"
                    onClick={() => setActiveTab("product")}
                  >
                    Back
                  </Button>
                  <Button type="submit" disabled={loading} size="lg" className="rounded-lg px-8 shadow-sm">
                    {loading ? "Saving…" : "Save product & batch"}
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </form>
    </div>
  )
}
