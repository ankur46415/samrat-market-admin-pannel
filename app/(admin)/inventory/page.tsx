"use client"

import { useState, useMemo, useEffect } from "react"
import Link from "next/link"
import { toast } from "sonner"
import {
  Plus,
  Upload,
  Search,
  Filter,
  MoreHorizontal,
  Pencil,
  Trash2,
  Barcode,
  Package,
  Box,
  Layers,
  Inbox,
  ScanBarcode,
  Tags,
  Loader2,
  Eye,
  EyeOff,
  FilePenLine,
  Download,
  ChevronDown,
} from "lucide-react"
import { format, differenceInCalendarDays, startOfDay } from "date-fns"
import { useProducts, useProductBrands, useProductTags } from "@/hooks/use-firestore"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { DeleteProductDialog } from "@/components/inventory/delete-product-dialog"
import { BarcodeDialog } from "@/components/inventory/barcode-dialog"
import { CsvUploadDialog } from "@/components/inventory/csv-upload-dialog"
import { BarcodeScannerInput } from "@/components/inventory/barcode-scanner-input"
import type { Product, ProductBatch } from "@/lib/types"
import { barcodesMatch, isLowStockProduct } from "@/lib/stock"
import {
  inventoryTableFrameClassName,
  invTableHeadClass,
  invTableCellClass,
  invTableCellNumeric,
} from "@/lib/inventory-ui"
import { cn } from "@/lib/utils"
import {
  downloadProductsCatalogCsv,
  downloadProductsCatalogJson,
} from "@/lib/features/inventory/products-catalog-export"
import { InventoryFieldSelect } from "@/components/inventory/inventory-field-select"
import { PRESET_LINE_DISCOUNTS, parseDiscountInput } from "@/lib/billing/line-discount"

type BatchRow = { batch: ProductBatch; product: Product }

function daysUntilExpiry(expiry: Date): number {
  return differenceInCalendarDays(startOfDay(expiry), startOfDay(new Date()))
}

function ExpiryCell({ date, noExpiry }: { date: Date; noExpiry?: boolean }) {
  if (noExpiry) {
    return (
      <span className="text-sm font-medium text-muted-foreground">No expiry</span>
    )
  }
  const d = daysUntilExpiry(date)
  const formatted = format(date, "dd MMM yyyy")
  let pill: { label: string; className: string } | null = null
  if (d < 0) pill = { label: "Expired", className: "bg-destructive/15 text-destructive border-destructive/30" }
  else if (d === 0) pill = { label: "Today", className: "bg-amber-500/15 text-amber-800 dark:text-amber-200 border-amber-500/30" }
  else if (d <= 7) pill = { label: `${d}d left`, className: "bg-amber-500/10 text-amber-900 dark:text-amber-100 border-amber-500/25" }

  return (
    <div className="flex flex-col gap-1.5 min-w-[7.5rem]">
      <span className="font-medium text-foreground tabular-nums">{formatted}</span>
      {pill ? (
        <Badge variant="outline" className={cn("w-fit text-[10px] px-1.5 py-0 font-semibold", pill.className)}>
          {pill.label}
        </Badge>
      ) : null}
    </div>
  )
}

export default function InventoryPage() {
  const {
    products,
    loading,
    deleteProduct,
    bulkUpdateProductCategory,
    bulkUpdateProductFields,
    bulkMoveToDraftList,
    moveToDraftList,
  } = useProducts()
  const { names: brandFilterOptions } = useProductBrands()
  const { names: tagFilterOptions } = useProductTags()
  const [search, setSearch] = useState("")
  const [searchMode, setSearchMode] = useState<"text" | "scan">("text")
  const [categoryFilter, setCategoryFilter] = useState<string>("all")
  const [brandFilter, setBrandFilter] = useState<string>("all")
  const [tagFilter, setTagFilter] = useState<string>("all")
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [productToDelete, setProductToDelete] = useState<Product | null>(null)
  const [productToDraft, setProductToDraft] = useState<Product | null>(null)
  const [movingToDraft, setMovingToDraft] = useState(false)
  const [barcodeDialogOpen, setBarcodeDialogOpen] = useState(false)
  const [productForBarcode, setProductForBarcode] = useState<Product | null>(null)
  const [csvDialogOpen, setCsvDialogOpen] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkCategoryOpen, setBulkCategoryOpen] = useState(false)
  const [bulkCategory, setBulkCategory] = useState("")
  const [bulkNewCategory, setBulkNewCategory] = useState("")
  const [bulkSaving, setBulkSaving] = useState(false)
  const [bulkEditOpen, setBulkEditOpen] = useState(false)
  const [bulkApplyBrand, setBulkApplyBrand] = useState(false)
  const [bulkApplyTag, setBulkApplyTag] = useState(false)
  const [bulkApplyDiscount, setBulkApplyDiscount] = useState(false)
  const [bulkBrand, setBulkBrand] = useState("")
  const [bulkTag, setBulkTag] = useState("")
  const [bulkDiscount, setBulkDiscount] = useState("0")
  const [bulkMoveDraftOpen, setBulkMoveDraftOpen] = useState(false)
  const [bulkMovingDraft, setBulkMovingDraft] = useState(false)
  const [showCost, setShowCost] = useState(false)
  const [inventoryTab, setInventoryTab] = useState<"products" | "batches">("products")
  const [lazyBatchRows, setLazyBatchRows] = useState<BatchRow[]>([])
  const [batchesLoading, setBatchesLoading] = useState(false)

  const categories = useMemo(() => {
    const cats = [...new Set(products.map((p) => p.category))]
    return cats.filter(Boolean).sort()
  }, [products])

  const selectedProducts = useMemo(
    () => products.filter((p) => selectedIds.has(p.id)),
    [products, selectedIds]
  )

  const filteredProducts = useMemo(() => {
    const q = search.trim()
    const qLower = q.toLowerCase()
    return products.filter((product) => {
      const matchesSearch =
        !q ||
        product.name.toLowerCase().includes(qLower) ||
        (product.barcode != null &&
          (barcodesMatch(product.barcode, q) || product.barcode.toLowerCase().includes(qLower)))
      const matchesCategory =
        categoryFilter === "all" || product.category === categoryFilter
      const brand = (product.brand ?? "").trim()
      const tag = (product.tag ?? "").trim()
      const matchesBrand = brandFilter === "all" || brand === brandFilter
      const matchesTag = tagFilter === "all" || tag === tagFilter
      return matchesSearch && matchesCategory && matchesBrand && matchesTag
    })
  }, [products, search, categoryFilter, brandFilter, tagFilter])

  const allFilteredSelected =
    filteredProducts.length > 0 && filteredProducts.every((p) => selectedIds.has(p.id))
  const someFilteredSelected =
    filteredProducts.some((p) => selectedIds.has(p.id)) && !allFilteredSelected

  const toggleSelect = (id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }

  const toggleSelectAllFiltered = (checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      filteredProducts.forEach((p) => {
        if (checked) next.add(p.id)
        else next.delete(p.id)
      })
      return next
    })
  }

  const openBulkCategory = () => {
    setBulkCategory("")
    setBulkNewCategory("")
    setBulkCategoryOpen(true)
  }

  const openBulkEdit = () => {
    setBulkApplyBrand(false)
    setBulkApplyTag(false)
    setBulkApplyDiscount(false)
    setBulkBrand("")
    setBulkTag("")
    setBulkDiscount("0")
    setBulkEditOpen(true)
  }

  const applyBulkEdit = async () => {
    if (!bulkApplyBrand && !bulkApplyTag && !bulkApplyDiscount) {
      toast.error("Select at least one field to update")
      return
    }
    const ids = [...selectedIds]
    if (ids.length === 0) return

    const patch: { tag?: string; brand?: string; discountPercent?: number } = {}
    if (bulkApplyBrand) patch.brand = bulkBrand.trim()
    if (bulkApplyTag) patch.tag = bulkTag.trim()
    if (bulkApplyDiscount) {
      const disc = parseDiscountInput(bulkDiscount)
      if (disc == null) {
        toast.error("Invalid discount %")
        return
      }
      patch.discountPercent = disc
    }

    setBulkSaving(true)
    try {
      await bulkUpdateProductFields(ids, patch, products)
      toast.success(`Updated ${ids.length} product${ids.length === 1 ? "" : "s"}`)
      setSelectedIds(new Set())
      setBulkEditOpen(false)
    } catch (e) {
      console.error(e)
      toast.error(e instanceof Error ? e.message : "Bulk update failed")
    } finally {
      setBulkSaving(false)
    }
  }

  const confirmBulkMoveToDraft = async () => {
    const ids = [...selectedIds]
    if (ids.length === 0) return
    setBulkMovingDraft(true)
    try {
      const { moved, failed } = await bulkMoveToDraftList(ids)
      if (moved > 0) {
        toast.success(`Moved ${moved} product${moved === 1 ? "" : "s"} to Draft Entries`)
      }
      if (failed.length > 0) {
        toast.error(
          `${failed.length} failed: ${failed.slice(0, 2).map((f) => f.message).join("; ")}${failed.length > 2 ? "…" : ""}`
        )
      }
      if (moved > 0) setSelectedIds(new Set())
      setBulkMoveDraftOpen(false)
    } catch (e) {
      console.error(e)
      toast.error(e instanceof Error ? e.message : "Failed to move to draft")
    } finally {
      setBulkMovingDraft(false)
    }
  }

  const applyBulkCategory = async () => {
    const category = (bulkCategory === "__new__" ? bulkNewCategory : bulkCategory).trim()
    if (!category) {
      toast.error("Select or enter a category")
      return
    }
    const ids = [...selectedIds]
    if (ids.length === 0) return
    setBulkSaving(true)
    try {
      await bulkUpdateProductCategory(ids, category)
      toast.success(`Moved ${ids.length} product${ids.length === 1 ? "" : "s"} to "${category}"`)
      setSelectedIds(new Set())
      setBulkCategoryOpen(false)
    } catch (e) {
      console.error(e)
      toast.error(e instanceof Error ? e.message : "Failed to update category")
    } finally {
      setBulkSaving(false)
    }
  }

  useEffect(() => {
    if (inventoryTab !== "batches") return

    setBatchesLoading(true)
    const rows: BatchRow[] = []
    for (const product of products) {
      for (const batch of product.batches) {
        rows.push({ product, batch })
      }
    }
    rows.sort((a, b) => a.batch.expiryDate.getTime() - b.batch.expiryDate.getTime())
    setLazyBatchRows(rows)
    setBatchesLoading(false)
  }, [inventoryTab, products])

  const batchRows = useMemo((): BatchRow[] => {
    if (inventoryTab !== "batches") return []
    const allowed = new Set(filteredProducts.map((p) => p.id))
    return lazyBatchRows
      .filter((row) => allowed.has(row.product.id))
      .sort((a, b) => a.batch.expiryDate.getTime() - b.batch.expiryDate.getTime())
  }, [filteredProducts, inventoryTab, lazyBatchRows])

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount)
  }

  const shortenId = (id: string) =>
    id.length <= 10 ? id : `${id.slice(0, 4)}…${id.slice(-4)}`

  const nextExpiryDate = (product: Product) => {
    if (product.batches[0]?.expiryDate) return product.batches[0].expiryDate
    if (product.expiry) {
      const d = new Date(product.expiry)
      if (!Number.isNaN(d.getTime())) return d
    }
    return undefined
  }

  const getStockBadge = (product: Product) => {
    if (product.stock === 0) {
      return <Badge variant="destructive">Out of stock</Badge>
    }
    if (isLowStockProduct(product)) {
      return (
        <Badge variant="outline" className="border-amber-500/50 text-amber-800 dark:text-amber-200 bg-amber-500/5">
          Low stock
        </Badge>
      )
    }
    return (
      <Badge variant="secondary" className="font-normal bg-emerald-500/10 text-emerald-800 dark:text-emerald-200 border-emerald-500/20">
        In stock
      </Badge>
    )
  }

  const handleDelete = (product: Product) => {
    setProductToDelete(product)
    setDeleteDialogOpen(true)
  }

  const handleMoveToDraft = (product: Product) => {
    setProductToDraft(product)
  }

  const confirmDelete = async () => {
    if (productToDelete) {
      await deleteProduct(productToDelete.id)
      setDeleteDialogOpen(false)
      setProductToDelete(null)
    }
  }

  const confirmMoveToDraft = async () => {
    if (!productToDraft) return
    setMovingToDraft(true)
    try {
      await moveToDraftList(productToDraft.id)
      toast.success(`"${productToDraft.name}" moved to Draft Entries as Inactive`)
      setProductToDraft(null)
    } catch (e) {
      console.error(e)
      toast.error(e instanceof Error ? e.message : "Failed to move to draft list")
    } finally {
      setMovingToDraft(false)
    }
  }

  const handleShowBarcode = (product: Product) => {
    setProductForBarcode(product)
    setBarcodeDialogOpen(true)
  }

  const handleExportCatalogCsv = (scope: "all" | "selected") => {
    const list = scope === "selected" ? selectedProducts : products
    if (list.length === 0) {
      toast.error(scope === "selected" ? "Select products to export" : "No products to export")
      return
    }
    downloadProductsCatalogCsv(list)
    toast.success(`Exported ${list.length} product${list.length === 1 ? "" : "s"} to products.csv`)
  }

  const handleExportCatalogJson = (scope: "all" | "selected") => {
    const list = scope === "selected" ? selectedProducts : products
    if (list.length === 0) {
      toast.error(scope === "selected" ? "Select products to export" : "No products to export")
      return
    }
    downloadProductsCatalogJson(list)
    toast.success(`Exported ${list.length} product${list.length === 1 ? "" : "s"} to products.json`)
  }

  if (loading) {
    return <InventorySkeleton />
  }

  return (
    <div className="mx-auto max-w-7xl space-y-8 pb-10">
      <div className="flex flex-col gap-6 border-b border-border/60 pb-8 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-primary">
            <Package className="h-7 w-7" aria-hidden />
            <span className="text-sm font-medium uppercase tracking-wide">Inventory</span>
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">Inventory</h1>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="default" className="shadow-sm">
                <Download className="mr-2 h-4 w-4" />
                Export
                <ChevronDown className="ml-2 h-4 w-4 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onClick={() => handleExportCatalogCsv("all")}>
                Export CSV — all products
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExportCatalogJson("all")}>
                Export JSON — all products
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                disabled={selectedIds.size === 0}
                onClick={() => handleExportCatalogCsv("selected")}
              >
                Export CSV — selected ({selectedIds.size})
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={selectedIds.size === 0}
                onClick={() => handleExportCatalogJson("selected")}
              >
                Export JSON — selected ({selectedIds.size})
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="outline" size="default" className="shadow-sm" onClick={() => setCsvDialogOpen(true)}>
            <Upload className="mr-2 h-4 w-4" />
            Import CSV
          </Button>
          <Button asChild className="shadow-sm">
            <Link href="/inventory/add">
              <Plus className="mr-2 h-4 w-4" />
              Add product & batch
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-border/70 bg-gradient-to-br from-card to-muted/20 p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Products</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">{filteredProducts.length}</p>
          <p className="text-xs text-muted-foreground">shown</p>
        </div>
        <div className="rounded-xl border border-border/70 bg-gradient-to-br from-card to-muted/20 p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Batches</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">{batchRows.length}</p>
          <p className="text-xs text-muted-foreground">shown</p>
        </div>
        <div className="rounded-xl border border-border/70 bg-gradient-to-br from-card to-muted/20 p-4 shadow-sm sm:col-span-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">All products</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">{products.length}</p>
          <p className="text-xs text-muted-foreground">total</p>
        </div>
      </div>

      <Card className="border-border/80 shadow-md shadow-black/5">
        <CardHeader className="space-y-1 border-b border-border/60 bg-muted/20 pb-4">
          <CardTitle className="text-lg">Search & filter</CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="mb-6 flex flex-col gap-3">
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant={searchMode === "text" ? "default" : "outline"}
                size="sm"
                className="gap-2 rounded-lg"
                onClick={() => setSearchMode("text")}
              >
                <Search className="h-4 w-4" />
                Search by name
              </Button>
              <Button
                type="button"
                variant={searchMode === "scan" ? "default" : "outline"}
                size="sm"
                className="gap-2 rounded-lg"
                onClick={() => setSearchMode("scan")}
              >
                <ScanBarcode className="h-4 w-4" />
                Scan barcode
              </Button>
              {search ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="rounded-lg text-muted-foreground"
                  onClick={() => setSearch("")}
                >
                  Clear
                </Button>
              ) : null}
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
              <div className="flex-1">
                {searchMode === "text" ? (
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Search by product name or barcode…"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="h-11 rounded-lg border-border/80 pl-10 shadow-sm"
                    />
                  </div>
                ) : (
                  <BarcodeScannerInput
                    value={search}
                    onChange={setSearch}
                    placeholder="Scan barcode with gun or type and press Enter…"
                    className="h-11 rounded-lg border-border/80 shadow-sm"
                  />
                )}
              </div>
              <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:flex-wrap">
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="h-11 w-full rounded-lg border-border/80 shadow-sm sm:w-[200px]">
                    <Filter className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All categories</SelectItem>
                    {categories.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={brandFilter} onValueChange={setBrandFilter}>
                  <SelectTrigger className="h-11 w-full rounded-lg border-border/80 shadow-sm sm:w-[180px]">
                    <SelectValue placeholder="Brand" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All brands</SelectItem>
                    {brandFilterOptions.map((name) => (
                      <SelectItem key={name} value={name}>
                        {name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={tagFilter} onValueChange={setTagFilter}>
                  <SelectTrigger className="h-11 w-full rounded-lg border-border/80 shadow-sm sm:w-[180px]">
                    <SelectValue placeholder="Tag" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All tags</SelectItem>
                    {tagFilterOptions.map((name) => (
                      <SelectItem key={name} value={name}>
                        {name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <Tabs
            value={inventoryTab}
            onValueChange={(v) => setInventoryTab(v as "products" | "batches")}
            className="w-full"
          >
            <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <TabsList className="grid h-auto w-full grid-cols-2 gap-1 rounded-xl bg-muted/60 p-1.5 sm:inline-flex sm:w-auto">
              <TabsTrigger
                value="products"
                className="gap-2 rounded-lg px-4 py-2.5 data-[state=active]:bg-background data-[state=active]:shadow-sm"
              >
                <Box className="h-4 w-4 shrink-0 opacity-70" />
                By product
              </TabsTrigger>
              <TabsTrigger
                value="batches"
                className="gap-2 rounded-lg px-4 py-2.5 data-[state=active]:bg-background data-[state=active]:shadow-sm"
              >
                <Layers className="h-4 w-4 shrink-0 opacity-70" />
                All batches
                {batchRows.length > 0 ? (
                  <span className="ml-1 rounded-md bg-primary/10 px-1.5 py-0.5 text-xs font-semibold text-primary tabular-nums">
                    {batchRows.length}
                  </span>
                ) : null}
              </TabsTrigger>
            </TabsList>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-2 self-start"
                onClick={() => setShowCost((v) => !v)}
              >
                {showCost ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                {showCost ? "Hide Cost" : "Show Cost"}
              </Button>
            </div>

            <TabsContent value="products" className="mt-0 focus-visible:outline-none">
              {selectedIds.size > 0 ? (
                <div className="mb-3 flex flex-wrap items-center gap-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
                  <span className="text-sm font-semibold">
                    {selectedIds.size} product{selectedIds.size === 1 ? "" : "s"} selected
                  </span>
                  <Button size="sm" className="gap-1.5" onClick={openBulkCategory}>
                    <Tags className="h-3.5 w-3.5" />
                    Change category
                  </Button>
                  <Button size="sm" variant="secondary" className="gap-1.5" onClick={openBulkEdit}>
                    <Pencil className="h-3.5 w-3.5" />
                    Bulk edit
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5"
                    onClick={() => setBulkMoveDraftOpen(true)}
                  >
                    <FilePenLine className="h-3.5 w-3.5" />
                    Move to draft
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>
                    Clear
                  </Button>
                </div>
              ) : null}
              <div className={inventoryTableFrameClassName()}>
                <Table>
                  <TableHeader>
                    <TableRow className="border-b-0 hover:bg-transparent">
                      <TableHead className={cn(invTableHeadClass, "w-10 pl-4")}>
                        <Checkbox
                          checked={allFilteredSelected ? true : someFilteredSelected ? "indeterminate" : false}
                          onCheckedChange={(checked) => toggleSelectAllFiltered(checked === true)}
                          aria-label="Select all visible products"
                          disabled={filteredProducts.length === 0}
                        />
                      </TableHead>
                      <TableHead className={invTableHeadClass}>Product</TableHead>
                      <TableHead className={cn(invTableHeadClass, "hidden md:table-cell")}>Category</TableHead>
                      <TableHead className={cn(invTableHeadClass, "hidden md:table-cell")}>Rack</TableHead>
                      <TableHead className={cn(invTableHeadClass, "text-right")}>MRP</TableHead>
                      <TableHead className={cn(invTableHeadClass, "text-right")}>Sell</TableHead>
                      {showCost ? (
                        <TableHead className={cn(invTableHeadClass, "text-right")}>Cost</TableHead>
                      ) : null}
                      <TableHead className={cn(invTableHeadClass, "text-right")}>Total qty</TableHead>
                      <TableHead className={cn(invTableHeadClass, "text-center w-[88px]")}>Batches</TableHead>
                      <TableHead className={cn(invTableHeadClass, "hidden sm:table-cell")}>Next expiry</TableHead>
                      <TableHead className={cn(invTableHeadClass, "w-[100px]")}>Status</TableHead>
                      <TableHead className={cn(invTableHeadClass, "w-12 pr-4 text-right")} />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredProducts.length === 0 ? (
                      <TableRow className="hover:bg-transparent">
                        <TableCell colSpan={showCost ? 12 : 11} className="h-40 text-center">
                          <div className="flex flex-col items-center justify-center gap-2 py-6">
                            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                              <Inbox className="h-6 w-6 text-muted-foreground" />
                            </div>
                            <p className="font-medium text-foreground">No products match</p>
                            <p className="max-w-sm text-sm text-muted-foreground">Try a different search or add a new item.</p>
                            <Button asChild variant="outline" size="sm" className="mt-2">
                              <Link href="/inventory/add">Add product & batch</Link>
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredProducts.map((product) => {
                        const next = nextExpiryDate(product)
                        const nextNoExpiry = product.batches[0]?.noExpiry === true
                        return (
                          <TableRow
                            key={product.id}
                            className="border-border/50 transition-colors hover:bg-muted/40"
                          >
                            <TableCell className={cn(invTableCellClass, "pl-4 w-10")}>
                              <Checkbox
                                checked={selectedIds.has(product.id)}
                                onCheckedChange={(checked) => toggleSelect(product.id, checked === true)}
                                aria-label={`Select ${product.name}`}
                              />
                            </TableCell>
                            <TableCell className={invTableCellClass}>
                              <div className="flex items-start gap-3">
                                <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                                  <Box className="h-4 w-4" />
                                </div>
                                <div className="min-w-0 space-y-0.5">
                                  <p className="font-semibold leading-tight text-foreground">{product.name}</p>
                                  {product.barcode ? (
                                    <p className="font-mono text-xs text-muted-foreground">{product.barcode}</p>
                                  ) : null}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className={cn(invTableCellClass, "hidden md:table-cell text-muted-foreground")}>
                              {product.category || "—"}
                            </TableCell>
                            <TableCell className={cn(invTableCellClass, "hidden md:table-cell text-muted-foreground")}>
                              {product.rack || "—"}
                            </TableCell>
                            <TableCell className={invTableCellNumeric}>
                              {product.mrp != null && product.mrp > 0 ? formatCurrency(product.mrp) : "—"}
                            </TableCell>
                            <TableCell className={invTableCellNumeric}>{formatCurrency(product.price)}</TableCell>
                            {showCost ? (
                              <TableCell className={cn(invTableCellNumeric, "text-muted-foreground")}>
                                {formatCurrency(product.costPrice)}
                              </TableCell>
                            ) : null}
                            <TableCell className={invTableCellNumeric}>
                              <span className="font-semibold text-foreground">{product.stock}</span>
                              <span className="ml-1 text-muted-foreground">{product.unit}</span>
                            </TableCell>
                            <TableCell className={cn(invTableCellClass, "text-center")}>
                              {(() => {
                                const count =
                                  inventoryTab === "batches"
                                    ? batchRows.filter((r) => r.product.id === product.id).length
                                    : product.batches.length
                                return count > 0 ? (
                                  <Badge variant="secondary" className="tabular-nums font-semibold">
                                    {count}
                                  </Badge>
                                ) : (
                                  <span className="text-xs text-muted-foreground">—</span>
                                )
                              })()}
                            </TableCell>
                            <TableCell className={cn(invTableCellClass, "hidden sm:table-cell")}>
                              {next ? (
                                <ExpiryCell date={next} noExpiry={nextNoExpiry} />
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </TableCell>
                            <TableCell className={invTableCellClass}>{getStockBadge(product)}</TableCell>
                            <TableCell className={cn(invTableCellClass, "pr-4 text-right")}>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-9 w-9 rounded-lg">
                                    <MoreHorizontal className="h-4 w-4" />
                                    <span className="sr-only">Actions</span>
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-48">
                                  <DropdownMenuItem asChild>
                                    <Link href={`/inventory/edit/${product.id}`}>
                                      <Pencil className="mr-2 h-4 w-4" />
                                      Edit & batches
                                    </Link>
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleShowBarcode(product)}>
                                    <Barcode className="mr-2 h-4 w-4" />
                                    Print barcode
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleMoveToDraft(product)}>
                                    <FilePenLine className="mr-2 h-4 w-4" />
                                    Move to draft list
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onClick={() => handleDelete(product)}
                                    className="text-destructive focus:text-destructive"
                                  >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Delete product
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        )
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            <TabsContent value="batches" className="mt-0 focus-visible:outline-none">
              {batchesLoading ? (
                <div className="flex h-40 items-center justify-center text-muted-foreground">
                  Loading batches…
                </div>
              ) : null}
              <div className={inventoryTableFrameClassName()}>
                <Table>
                  <TableHeader>
                    <TableRow className="border-b-0 hover:bg-transparent">
                      <TableHead className={invTableHeadClass}>Product</TableHead>
                      <TableHead className={cn(invTableHeadClass, "w-[100px]")}>Batch</TableHead>
                      <TableHead className={invTableHeadClass}>Expiry</TableHead>
                      <TableHead className={cn(invTableHeadClass, "text-right")}>Qty</TableHead>
                      <TableHead className={cn(invTableHeadClass, "hidden md:table-cell text-muted-foreground")}>
                        Added
                      </TableHead>
                      <TableHead className={cn(invTableHeadClass, "w-12 pr-4 text-right")} />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {batchRows.length === 0 ? (
                      <TableRow className="hover:bg-transparent">
                        <TableCell colSpan={6} className="h-40 text-center">
                          <div className="flex flex-col items-center justify-center gap-2 py-6">
                            <Layers className="h-10 w-10 text-muted-foreground/60" />
                            <p className="font-medium text-foreground">No batches in this view</p>
                            <Button asChild variant="outline" size="sm" className="mt-2">
                              <Link href="/inventory/add">Add stock</Link>
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      batchRows.map(({ batch, product }) => (
                        <TableRow
                          key={`${product.id}-${batch.id}`}
                          className="border-border/50 transition-colors hover:bg-muted/40"
                        >
                          <TableCell className={invTableCellClass}>
                            <div className="min-w-0 space-y-0.5">
                              <p className="font-semibold leading-tight">{product.name}</p>
                              {product.barcode ? (
                                <p className="font-mono text-xs text-muted-foreground">{product.barcode}</p>
                              ) : null}
                            </div>
                          </TableCell>
                          <TableCell className={invTableCellClass}>
                            <code className="rounded-md bg-muted px-2 py-1 font-mono text-[11px] leading-none text-foreground">
                              {shortenId(batch.id)}
                            </code>
                          </TableCell>
                          <TableCell className={invTableCellClass}>
                            <ExpiryCell date={batch.expiryDate} noExpiry={batch.noExpiry} />
                          </TableCell>
                          <TableCell className={invTableCellNumeric}>
                            <span className="font-semibold">{batch.quantity}</span>
                            <span className="ml-1 text-muted-foreground">{product.unit}</span>
                          </TableCell>
                          <TableCell className={cn(invTableCellClass, "hidden md:table-cell text-muted-foreground text-xs")}>
                            {format(batch.createdAt, "dd MMM yyyy · HH:mm")}
                          </TableCell>
                          <TableCell className={cn(invTableCellClass, "pr-4 text-right")}>
                            <Button variant="outline" size="sm" className="h-8 rounded-lg" asChild>
                              <Link href={`/inventory/edit/${product.id}`}>
                                <Pencil className="mr-1.5 h-3.5 w-3.5" />
                                Edit
                              </Link>
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <DeleteProductDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        product={productToDelete}
        onConfirm={confirmDelete}
      />

      <AlertDialog open={!!productToDraft} onOpenChange={(open) => !open && setProductToDraft(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Move to draft list?</AlertDialogTitle>
            <AlertDialogDescription>
              {productToDraft ? (
                <>
                  &quot;{productToDraft.name}&quot; will be removed from All Products and appear in Draft
                  Entries with status <strong>Inactive</strong>. Billing will be blocked until you set it Active
                  in Draft Entries and approve it back to inventory.
                </>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={movingToDraft}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={movingToDraft}
              onClick={(e) => {
                e.preventDefault()
                void confirmMoveToDraft()
              }}
            >
              {movingToDraft ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Move to draft
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <BarcodeDialog
        open={barcodeDialogOpen}
        onOpenChange={setBarcodeDialogOpen}
        product={productForBarcode}
      />

      <CsvUploadDialog open={csvDialogOpen} onOpenChange={setCsvDialogOpen} />

      <AlertDialog open={bulkMoveDraftOpen} onOpenChange={setBulkMoveDraftOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Move {selectedIds.size} products to draft?</AlertDialogTitle>
            <AlertDialogDescription>
              Selected items will be removed from All Products and appear in Draft Entries as{" "}
              <strong>Inactive</strong>. Items already in draft or without a barcode may fail.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkMovingDraft}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={bulkMovingDraft}
              onClick={(e) => {
                e.preventDefault()
                void confirmBulkMoveToDraft()
              }}
            >
              {bulkMovingDraft ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Move to draft
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={bulkEditOpen} onOpenChange={setBulkEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Bulk edit {selectedIds.size} products</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="flex items-start gap-3">
              <Checkbox
                id="bulk-apply-brand"
                checked={bulkApplyBrand}
                onCheckedChange={(c) => setBulkApplyBrand(c === true)}
                className="mt-1"
              />
              <div className="flex-1 space-y-2">
                <Label htmlFor="bulk-apply-brand">Brand</Label>
                <InventoryFieldSelect
                  value={bulkBrand}
                  onChange={setBulkBrand}
                  options={brandFilterOptions}
                  placeholder="Select brand"
                  disabled={!bulkApplyBrand}
                  allowEmpty
                />
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Checkbox
                id="bulk-apply-tag"
                checked={bulkApplyTag}
                onCheckedChange={(c) => setBulkApplyTag(c === true)}
                className="mt-1"
              />
              <div className="flex-1 space-y-2">
                <Label htmlFor="bulk-apply-tag">Tag</Label>
                <InventoryFieldSelect
                  value={bulkTag}
                  onChange={setBulkTag}
                  options={tagFilterOptions}
                  placeholder="Select tag"
                  disabled={!bulkApplyTag}
                  allowEmpty
                />
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Checkbox
                id="bulk-apply-discount"
                checked={bulkApplyDiscount}
                onCheckedChange={(c) => setBulkApplyDiscount(c === true)}
                className="mt-1"
              />
              <div className="flex-1 space-y-2">
                <Label htmlFor="bulk-apply-discount">Discount %</Label>
                <Select
                  value={bulkDiscount}
                  onValueChange={setBulkDiscount}
                  disabled={!bulkApplyDiscount}
                >
                  <SelectTrigger id="bulk-apply-discount">
                    <SelectValue placeholder="Discount %" />
                  </SelectTrigger>
                  <SelectContent>
                    {PRESET_LINE_DISCOUNTS.map((d) => (
                      <SelectItem key={d} value={String(d)}>
                        {d}%
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Selling price updates automatically when MRP is set on a product.
                </p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkEditOpen(false)} disabled={bulkSaving}>
              Cancel
            </Button>
            <Button
              onClick={() => void applyBulkEdit()}
              disabled={bulkSaving || (!bulkApplyBrand && !bulkApplyTag && !bulkApplyDiscount)}
            >
              {bulkSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Apply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={bulkCategoryOpen} onOpenChange={setBulkCategoryOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Change category for {selectedIds.size} products</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="space-y-1.5">
              <Label>New category</Label>
              <Select value={bulkCategory} onValueChange={setBulkCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                  <SelectItem value="__new__">+ Add new category</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {bulkCategory === "__new__" ? (
              <div className="space-y-1.5">
                <Label htmlFor="bulk-new-category">Category name</Label>
                <Input
                  id="bulk-new-category"
                  placeholder="e.g. Stationery"
                  value={bulkNewCategory}
                  onChange={(e) => setBulkNewCategory(e.target.value)}
                />
              </div>
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkCategoryOpen(false)} disabled={bulkSaving}>
              Cancel
            </Button>
            <Button onClick={() => void applyBulkCategory()} disabled={bulkSaving || !bulkCategory}>
              {bulkSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Move products
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function InventorySkeleton() {
  return (
    <div className="mx-auto max-w-7xl space-y-8 pb-10">
      <div className="flex flex-col gap-4 border-b pb-8 sm:flex-row sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-9 w-64" />
          <Skeleton className="h-4 w-full max-w-md" />
        </div>
        <Skeleton className="h-10 w-40" />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-24 rounded-xl sm:col-span-2" />
      </div>
      <Skeleton className="h-[420px] rounded-xl" />
    </div>
  )
}
