"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
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
} from "lucide-react"
import { format, differenceInCalendarDays, startOfDay } from "date-fns"
import { useProducts } from "@/hooks/use-firestore"
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

type BatchRow = { batch: ProductBatch; product: Product }

function daysUntilExpiry(expiry: Date): number {
  return differenceInCalendarDays(startOfDay(expiry), startOfDay(new Date()))
}

function ExpiryCell({ date }: { date: Date }) {
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
  const { products, loading, deleteProduct } = useProducts()
  const [search, setSearch] = useState("")
  const [searchMode, setSearchMode] = useState<"text" | "scan">("text")
  const [categoryFilter, setCategoryFilter] = useState<string>("all")
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [productToDelete, setProductToDelete] = useState<Product | null>(null)
  const [barcodeDialogOpen, setBarcodeDialogOpen] = useState(false)
  const [productForBarcode, setProductForBarcode] = useState<Product | null>(null)
  const [csvDialogOpen, setCsvDialogOpen] = useState(false)

  const categories = useMemo(() => {
    const cats = [...new Set(products.map((p) => p.category))]
    return cats.filter(Boolean).sort()
  }, [products])

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
      return matchesSearch && matchesCategory
    })
  }, [products, search, categoryFilter])

  const batchRows = useMemo((): BatchRow[] => {
    const rows: BatchRow[] = []
    for (const p of filteredProducts) {
      for (const b of p.batches) {
        rows.push({ batch: b, product: p })
      }
    }
    return rows.sort(
      (a, b) => a.batch.expiryDate.getTime() - b.batch.expiryDate.getTime()
    )
  }, [filteredProducts])

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount)
  }

  const shortenId = (id: string) =>
    id.length <= 10 ? id : `${id.slice(0, 4)}…${id.slice(-4)}`

  const nextExpiryDate = (product: Product) => product.batches[0]?.expiryDate

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

  const confirmDelete = async () => {
    if (productToDelete) {
      await deleteProduct(productToDelete.id)
      setDeleteDialogOpen(false)
      setProductToDelete(null)
    }
  }

  const handleShowBarcode = (product: Product) => {
    setProductForBarcode(product)
    setBarcodeDialogOpen(true)
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
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="h-11 w-full rounded-lg border-border/80 shadow-sm sm:w-[220px]">
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
            </div>
          </div>

          <Tabs defaultValue="products" className="w-full">
            <TabsList className="mb-6 grid h-auto w-full grid-cols-2 gap-1 rounded-xl bg-muted/60 p-1.5 sm:inline-flex sm:w-auto">
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

            <TabsContent value="products" className="mt-0 focus-visible:outline-none">
              <div className={inventoryTableFrameClassName()}>
                <Table>
                  <TableHeader>
                    <TableRow className="border-b-0 hover:bg-transparent">
                      <TableHead className={invTableHeadClass}>Product</TableHead>
                      <TableHead className={cn(invTableHeadClass, "hidden md:table-cell")}>Category</TableHead>
                      <TableHead className={cn(invTableHeadClass, "hidden md:table-cell")}>Rack</TableHead>
                      <TableHead className={cn(invTableHeadClass, "text-right")}>MRP / sell</TableHead>
                      <TableHead className={cn(invTableHeadClass, "hidden lg:table-cell text-right")}>Cost</TableHead>
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
                        <TableCell colSpan={10} className="h-40 text-center">
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
                        return (
                          <TableRow
                            key={product.id}
                            className="border-border/50 transition-colors hover:bg-muted/40"
                          >
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
                            <TableCell className={invTableCellNumeric}>{formatCurrency(product.price)}</TableCell>
                            <TableCell className={cn(invTableCellNumeric, "hidden lg:table-cell text-muted-foreground")}>
                              {formatCurrency(product.costPrice)}
                            </TableCell>
                            <TableCell className={invTableCellNumeric}>
                              <span className="font-semibold text-foreground">{product.stock}</span>
                              <span className="ml-1 text-muted-foreground">{product.unit}</span>
                            </TableCell>
                            <TableCell className={cn(invTableCellClass, "text-center")}>
                              {product.batches.length > 0 ? (
                                <Badge variant="secondary" className="tabular-nums font-semibold">
                                  {product.batches.length}
                                </Badge>
                              ) : (
                                <span className="text-xs text-muted-foreground">—</span>
                              )}
                            </TableCell>
                            <TableCell className={cn(invTableCellClass, "hidden sm:table-cell")}>
                              {next ? (
                                <ExpiryCell date={next} />
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
                            <ExpiryCell date={batch.expiryDate} />
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

      <BarcodeDialog
        open={barcodeDialogOpen}
        onOpenChange={setBarcodeDialogOpen}
        product={productForBarcode}
      />

      <CsvUploadDialog open={csvDialogOpen} onOpenChange={setCsvDialogOpen} />
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
