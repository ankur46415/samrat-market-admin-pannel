"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, ImagePlus, Package, Layers, X } from "lucide-react"
import { useProducts, useCategories } from "@/hooks/use-firestore"
import { BarcodeScannerInput } from "@/components/inventory/barcode-scanner-input"
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
import { Checkbox } from "@/components/ui/checkbox"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import { toast } from "sonner"
import { normalizeProductUnit, parseMinStockInput } from "@/lib/stock"
import { discountedUnitPrice, parseDiscountInput } from "@/lib/billing/line-discount"
import { cn } from "@/lib/utils"
import { RACK_OPTIONS, RACK_OPTIONS_SET } from "@/lib/rack-options"
import { STATUS_OPTIONS, STATUS_OPTIONS_SET } from "@/lib/status-options"
import {
  uploadProductImage,
  validateProductImageFile,
} from "@/lib/features/inventory/services/product_image_service"

const labelClass = "text-sm font-medium text-foreground"
const inputClass = "h-11 rounded-lg border-border/80 shadow-sm"
const fieldGroup = "space-y-2"

function sellingPriceFromMrp(mrp: string, discountPercent: string): string | null {
  const m = parseFloat(mrp)
  if (!Number.isFinite(m) || m <= 0) return null
  const d = parseDiscountInput(discountPercent) ?? 0
  return String(discountedUnitPrice(m, d))
}

export default function AddProductPage() {
  const router = useRouter()
  const { addProduct, getProductByBarcode, updateProduct } = useProducts()
  const { categories } = useCategories()
  const [loading, setLoading] = useState(false)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const [activeTab, setActiveTab] = useState<"product" | "batch">("product")
  const [newCategory, setNewCategory] = useState("")
  const [showNewCategory, setShowNewCategory] = useState(false)

  const [formData, setFormData] = useState({
    name: "",
    category: "",
    rack: "",
    tag: "",
    status: "active",
    mrp: "",
    discountPercent: "",
    price: "",
    costPrice: "",
    stock: "",
    unit: "pcs",
    barcode: "",
    brand: "",
    expiry: "",
    noExpiry: false,
    minStock: "10",
  })

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const barcode = params.get("barcode")?.trim()
    if (barcode) {
      setFormData((prev) => ({ ...prev, barcode }))
    }
  }, [])

  useEffect(() => {
    if (!imageFile) {
      setImagePreviewUrl(null)
      return
    }
    const url = URL.createObjectURL(imageFile)
    setImagePreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [imageFile])

  const handleImageSelect = (file: File | null) => {
    if (!file) {
      setImageFile(null)
      return
    }
    const err = validateProductImageFile(file)
    if (err) {
      toast.error(err)
      return
    }
    setImageFile(file)
  }

  const clearImage = () => {
    setImageFile(null)
    if (imageInputRef.current) imageInputRef.current.value = ""
  }

  const handleMrpChange = (mrp: string) => {
    setFormData((prev) => {
      const next = { ...prev, mrp }
      const autoPrice = sellingPriceFromMrp(mrp, prev.discountPercent)
      if (autoPrice != null) next.price = autoPrice
      return next
    })
  }

  const handleDiscountChange = (discountPercent: string) => {
    setFormData((prev) => {
      const next = { ...prev, discountPercent }
      const autoPrice = sellingPriceFromMrp(prev.mrp, discountPercent)
      if (autoPrice != null) next.price = autoPrice
      return next
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (activeTab !== "batch") {
      setActiveTab("batch")
      toast.info("Review batch details (optional) and save")
      return
    }

    if (!formData.barcode.trim()) {
      toast.error("Barcode is required")
      return
    }
    if (formData.rack && !RACK_OPTIONS_SET.has(formData.rack as (typeof RACK_OPTIONS)[number])) {
      toast.error("Select a valid rack or leave empty")
      return
    }
    if (!formData.status || !STATUS_OPTIONS_SET.has(formData.status as (typeof STATUS_OPTIONS)[number])) {
      toast.error("Select status")
      return
    }
    const stockNum = parseInt(formData.stock, 10)
    if (formData.expiry && (!Number.isFinite(stockNum) || stockNum <= 0)) {
      toast.error("Batch quantity must be greater than 0 when expiry is set")
      return
    }
    if (Number.isFinite(stockNum) && stockNum > 0 && !formData.expiry && !formData.noExpiry) {
      toast.error("Select batch expiry or tick No expiry when quantity is set")
      return
    }
    if (formData.noExpiry && formData.expiry) {
      toast.error("Clear expiry date or uncheck No expiry")
      return
    }
    if (!formData.price || parseFloat(formData.price) < 0) {
      toast.error("Please fill in selling price")
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
      const productId = await addProduct({
        name: formData.name || "Unnamed Product",
        category,
        rack: formData.rack,
        tag: formData.tag,
        status: formData.status,
        price: parseFloat(formData.price),
        costPrice: formData.costPrice.trim() ? parseFloat(formData.costPrice) : 0,
        mrp: formData.mrp.trim() ? parseFloat(formData.mrp) : undefined,
        discountPercent: parseDiscountInput(formData.discountPercent) || undefined,
        stock: Number.isFinite(stockNum) && stockNum > 0 ? stockNum : 0,
        unit: normalizeProductUnit(formData.unit),
        barcode: formData.barcode || undefined,
        brand: formData.brand || undefined,
        expiry: formData.noExpiry ? undefined : formData.expiry || undefined,
        noExpiry: formData.noExpiry || undefined,
        minStock: parseMinStockInput(formData.minStock, 10),
      })

      if (imageFile) {
        try {
          const imageUrl = await uploadProductImage(productId, imageFile)
          await updateProduct(productId, { imageUrl })
        } catch (imageError) {
          console.error("Product image upload failed:", imageError)
          toast.warning("Product saved, but image upload failed")
        }
      }

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
                    <BarcodeScannerInput
                      id="barcode"
                      placeholder="e.g. 8901234567890"
                      value={formData.barcode}
                      onChange={(barcode) => setFormData({ ...formData, barcode })}
                      className={inputClass}
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

                  <div className={cn(fieldGroup, "sm:col-span-2")}>
                    <Label htmlFor="productImage" className={labelClass}>
                      Product image{" "}
                      <span className="font-normal text-muted-foreground">(optional)</span>
                    </Label>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                      {imagePreviewUrl ? (
                        <div className="relative h-28 w-28 shrink-0 overflow-hidden rounded-lg border border-border/80 bg-muted/30">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={imagePreviewUrl}
                            alt="Product preview"
                            className="h-full w-full object-cover"
                          />
                          <Button
                            type="button"
                            variant="secondary"
                            size="icon"
                            className="absolute right-1 top-1 h-7 w-7 rounded-md shadow-sm"
                            onClick={clearImage}
                            aria-label="Remove image"
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => imageInputRef.current?.click()}
                          className="flex h-28 w-full max-w-xs flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border/80 bg-muted/20 px-4 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:bg-muted/40 hover:text-foreground"
                        >
                          <ImagePlus className="h-6 w-6 opacity-70" />
                          <span>Choose image</span>
                          <span className="text-xs">JPG, PNG, WebP — max 5 MB</span>
                        </button>
                      )}
                      <input
                        ref={imageInputRef}
                        id="productImage"
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        className="hidden"
                        onChange={(e) => handleImageSelect(e.target.files?.[0] ?? null)}
                      />
                      {imagePreviewUrl ? (
                        <div className="flex flex-col gap-2 pt-1">
                          <p className="text-sm text-muted-foreground">{imageFile?.name}</p>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="w-fit rounded-lg"
                            onClick={() => imageInputRef.current?.click()}
                          >
                            Change image
                          </Button>
                        </div>
                      ) : null}
                    </div>
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
                      Rack <span className="font-normal text-muted-foreground">(optional)</span>
                    </Label>
                    <Select
                      value={formData.rack || undefined}
                      onValueChange={(value) => setFormData({ ...formData, rack: value })}
                    >
                      <SelectTrigger className={cn(inputClass, "w-full")}>
                        <SelectValue placeholder="Select rack (optional)" />
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
                    <Select
                      value={formData.status}
                      onValueChange={(value) => setFormData({ ...formData, status: value })}
                    >
                      <SelectTrigger className={cn(inputClass, "w-full")}>
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTIONS.map((opt) => (
                          <SelectItem key={opt} value={opt}>
                            {opt}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
                      <Label htmlFor="mrp" className={labelClass}>
                        MRP (INR)
                      </Label>
                      <Input
                        id="mrp"
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        value={formData.mrp}
                        onChange={(e) => handleMrpChange(e.target.value)}
                        className={cn(inputClass, "tabular-nums")}
                      />
                    </div>
                    <div className={fieldGroup}>
                      <Label htmlFor="discountPercent" className={labelClass}>
                        Discount (%)
                      </Label>
                      <Input
                        id="discountPercent"
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        placeholder="e.g. 10"
                        value={formData.discountPercent}
                        onChange={(e) => handleDiscountChange(e.target.value)}
                        className={cn(inputClass, "tabular-nums")}
                      />
                      <p className="text-xs text-muted-foreground">
                        MRP par % discount ke baad selling price auto fill hoti hai
                      </p>
                    </div>
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
                        Cost price (INR) <span className="font-normal text-muted-foreground">(optional)</span>
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
                <p className="text-sm text-muted-foreground">
                  Expiry date optional hai — non-perishable items ke liye &quot;No expiry&quot; choose karein aur quantity
                  bharein.
                </p>
                <div className="grid max-w-xl gap-6 sm:grid-cols-2">
                  <div className={cn(fieldGroup, "sm:col-span-2")}>
                    <div className="flex items-center gap-3 rounded-lg border border-border/70 bg-muted/20 px-4 py-3">
                      <Checkbox
                        id="noExpiry"
                        checked={formData.noExpiry}
                        onCheckedChange={(checked) =>
                          setFormData({
                            ...formData,
                            noExpiry: checked === true,
                            expiry: checked === true ? "" : formData.expiry,
                          })
                        }
                      />
                      <Label htmlFor="noExpiry" className="cursor-pointer text-sm font-medium leading-snug">
                        No expiry — is product par expiry date nahi hai (e.g. soap, utensils, hardware)
                      </Label>
                    </div>
                  </div>
                  <div className={fieldGroup}>
                    <Label htmlFor="expiry" className={labelClass}>
                      Batch expiry{" "}
                      <span className="font-normal text-muted-foreground">
                        {formData.noExpiry ? "(disabled)" : "(optional)"}
                      </span>
                    </Label>
                    <Input
                      id="expiry"
                      type="date"
                      value={formData.expiry}
                      disabled={formData.noExpiry}
                      onChange={(e) =>
                        setFormData({ ...formData, expiry: e.target.value, noExpiry: false })
                      }
                      className={inputClass}
                    />
                  </div>

                  <div className={fieldGroup}>
                    <Label htmlFor="stock" className={labelClass}>
                      Quantity in this batch <span className="font-normal text-muted-foreground">(optional)</span>
                    </Label>
                    <Input
                      id="stock"
                      type="number"
                      min="0"
                      placeholder="0"
                      value={formData.stock}
                      onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                      className={cn(inputClass, "tabular-nums")}
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
                    {loading ? "Saving…" : "Save product"}
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
