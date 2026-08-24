"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { format } from "date-fns"
import {
  AlertCircle,
  ArrowDownUp,
  Building2,
  FileJson,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Trash2,
  Truck,
  Upload,
} from "lucide-react"
import { toast } from "sonner"
import { useProductSuppliers } from "@/hooks/use-product-suppliers"
import {
  computeSaleRate,
  type ProductSupplier,
  type SupplierOrderItem,
} from "@/lib/features/product-suppliers/models"
import {
  emptyOrderLine,
  type OrderLineDraft,
} from "@/lib/features/product-suppliers/order-line-draft"
import {
  parseSupplierOrderJson,
  SUPPLIER_ORDER_JSON_EXAMPLE,
} from "@/lib/features/product-suppliers/parse-order-json"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

type SortKey =
  | "orderDate-desc"
  | "orderDate-asc"
  | "supplier-asc"
  | "product-asc"
  | "orderTag-asc"
  | "delivered-desc"

const UNTAGGED_ORDER = "__untagged__"

const MANUAL_ROW_PREVIEW_LIMIT = 15

type OrderEntryTab = "manual" | "json"

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(amount)
}

function formatDateInput(date: Date) {
  return format(date, "yyyy-MM-dd")
}

function parseDateInput(value: string): Date | null {
  if (!value.trim()) return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

export function ProductSuppliersDashboard() {
  const {
    suppliers,
    orderItems,
    loading,
    createSupplier,
    editSupplier,
    removeSupplier,
    createOrderItems,
    editOrderItem,
    removeOrderItem,
    removeOrderItems,
  } = useProductSuppliers()

  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const [bulkDeleting, setBulkDeleting] = useState(false)

  const [search, setSearch] = useState("")
  const [supplierFilter, setSupplierFilter] = useState("all")
  const [orderTagFilter, setOrderTagFilter] = useState("all")
  const [sortKey, setSortKey] = useState<SortKey>("orderDate-desc")

  const [supplierDialogOpen, setSupplierDialogOpen] = useState(false)
  const [manageSuppliersOpen, setManageSuppliersOpen] = useState(false)
  const [orderDialogOpen, setOrderDialogOpen] = useState(false)
  const [editItemDialogOpen, setEditItemDialogOpen] = useState(false)

  const [editingSupplier, setEditingSupplier] = useState<ProductSupplier | null>(null)
  const [editingItem, setEditingItem] = useState<SupplierOrderItem | null>(null)
  const [saving, setSaving] = useState(false)

  const [supplierForm, setSupplierForm] = useState({
    name: "",
    phone: "",
    email: "",
    address: "",
    notes: "",
  })

  const [orderForm, setOrderForm] = useState({
    supplierId: "",
    orderTag: "",
    orderDate: formatDateInput(new Date()),
    lines: [emptyOrderLine()],
  })
  const [orderEntryTab, setOrderEntryTab] = useState<OrderEntryTab>("manual")
  const [jsonText, setJsonText] = useState("")
  const [jsonError, setJsonError] = useState("")
  const [jsonPreviewLines, setJsonPreviewLines] = useState<OrderLineDraft[] | null>(null)
  const jsonFileRef = useRef<HTMLInputElement>(null)

  const [editItemForm, setEditItemForm] = useState({
    supplierId: "",
    orderTag: "",
    product: "",
    brand: "",
    buyRate: "",
    mrp: "",
    productId: "",
    discountPercent: "",
    orderDate: "",
    deliveredDate: "",
  })

  const supplierScopedItems = useMemo(() => {
    if (supplierFilter === "all") return orderItems
    return orderItems.filter((item) => item.supplierId === supplierFilter)
  }, [orderItems, supplierFilter])

  const availableOrderTags = useMemo(() => {
    const tags = new Set<string>()
    let hasUntagged = false
    supplierScopedItems.forEach((item) => {
      const tag = item.orderTag?.trim()
      if (tag) tags.add(tag)
      else hasUntagged = true
    })
    const sorted = [...tags].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }))
    if (hasUntagged) sorted.unshift(UNTAGGED_ORDER)
    return sorted
  }, [supplierScopedItems])

  useEffect(() => {
    setOrderTagFilter("all")
  }, [supplierFilter])

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase()
    let rows = orderItems.filter((item) => {
      if (supplierFilter !== "all" && item.supplierId !== supplierFilter) return false
      if (orderTagFilter !== "all") {
        const tag = item.orderTag?.trim() || ""
        if (orderTagFilter === UNTAGGED_ORDER) {
          if (tag) return false
        } else if (tag !== orderTagFilter) {
          return false
        }
      }
      if (!q) return true
      return (
        item.product.toLowerCase().includes(q) ||
        item.brand.toLowerCase().includes(q) ||
        item.productId.toLowerCase().includes(q) ||
        item.supplierName.toLowerCase().includes(q) ||
        (item.orderTag?.toLowerCase().includes(q) ?? false)
      )
    })

    rows = [...rows].sort((a, b) => {
      switch (sortKey) {
        case "orderDate-asc":
          return a.orderDate.getTime() - b.orderDate.getTime()
        case "supplier-asc":
          return a.supplierName.localeCompare(b.supplierName, undefined, { sensitivity: "base" })
        case "product-asc":
          return a.product.localeCompare(b.product, undefined, { sensitivity: "base" })
        case "orderTag-asc": {
          const tagCmp = (a.orderTag || "").localeCompare(b.orderTag || "", undefined, {
            sensitivity: "base",
          })
          if (tagCmp !== 0) return tagCmp
          return b.orderDate.getTime() - a.orderDate.getTime()
        }
        case "delivered-desc": {
          const ad = a.deliveredDate?.getTime() ?? 0
          const bd = b.deliveredDate?.getTime() ?? 0
          return bd - ad
        }
        case "orderDate-desc":
        default:
          return b.orderDate.getTime() - a.orderDate.getTime()
      }
    })

    return rows
  }, [orderItems, search, supplierFilter, orderTagFilter, sortKey])

  const selectedCount = useMemo(() => {
    const validIds = new Set(orderItems.map((i) => i.id))
    let count = 0
    selectedIds.forEach((id) => {
      if (validIds.has(id)) count++
    })
    return count
  }, [selectedIds, orderItems])

  const allFilteredSelected =
    filteredItems.length > 0 && filteredItems.every((item) => selectedIds.has(item.id))
  const someFilteredSelected =
    filteredItems.some((item) => selectedIds.has(item.id)) && !allFilteredSelected

  useEffect(() => {
    const validIds = new Set(orderItems.map((i) => i.id))
    setSelectedIds((prev) => {
      const next = new Set<string>()
      prev.forEach((id) => {
        if (validIds.has(id)) next.add(id)
      })
      return next.size === prev.size ? prev : next
    })
  }, [orderItems])

  const toggleSelectItem = (id: string, checked: boolean) => {
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
      if (checked) {
        filteredItems.forEach((item) => next.add(item.id))
      } else {
        filteredItems.forEach((item) => next.delete(item.id))
      }
      return next
    })
  }

  const clearSelection = () => setSelectedIds(new Set())

  const openAddSupplier = () => {
    setEditingSupplier(null)
    setSupplierForm({ name: "", phone: "", email: "", address: "", notes: "" })
    setSupplierDialogOpen(true)
  }

  const openEditSupplier = (supplier: ProductSupplier) => {
    setEditingSupplier(supplier)
    setSupplierForm({
      name: supplier.name,
      phone: supplier.phone ?? "",
      email: supplier.email ?? "",
      address: supplier.address ?? "",
      notes: supplier.notes ?? "",
    })
    setSupplierDialogOpen(true)
  }

  const openCreateOrder = () => {
    setOrderForm({
      supplierId: suppliers[0]?.id ?? "",
      orderTag: "",
      orderDate: formatDateInput(new Date()),
      lines: [emptyOrderLine()],
    })
    setOrderEntryTab("manual")
    setJsonText("")
    setJsonError("")
    setJsonPreviewLines(null)
    setOrderDialogOpen(true)
  }

  const applyParsedJson = (raw: string) => {
    const result = parseSupplierOrderJson(raw)
    if (!result.ok) {
      setJsonError(result.error)
      setJsonPreviewLines(null)
      return
    }
    setJsonError("")
    setJsonPreviewLines(result.lines)
    setOrderForm((prev) => ({
      ...prev,
      lines: result.lines,
      orderTag: result.orderTag ?? prev.orderTag,
    }))
    const skippedMsg = result.skipped > 0 ? ` (${result.skipped} invalid rows skipped)` : ""
    toast.success(`Loaded ${result.lines.length} items from JSON${skippedMsg}`)
  }

  const handleJsonFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = String(ev.target?.result ?? "")
      setJsonText(text)
      applyParsedJson(text)
    }
    reader.readAsText(file)
    e.target.value = ""
  }

  const openEditItem = (item: SupplierOrderItem) => {
    setEditingItem(item)
    setEditItemForm({
      supplierId: item.supplierId,
      orderTag: item.orderTag ?? "",
      product: item.product,
      brand: item.brand,
      buyRate: String(item.buyRate),
      mrp: String(item.mrp),
      productId: item.productId,
      discountPercent: String(item.discountPercent),
      orderDate: formatDateInput(item.orderDate),
      deliveredDate: item.deliveredDate ? formatDateInput(item.deliveredDate) : "",
    })
    setEditItemDialogOpen(true)
  }

  const handleSaveSupplier = async () => {
    if (!supplierForm.name.trim()) {
      toast.error("Supplier name is required")
      return
    }
    try {
      setSaving(true)
      if (editingSupplier) {
        await editSupplier(editingSupplier.id, supplierForm)
        toast.success("Supplier updated")
      } else {
        await createSupplier(supplierForm)
        toast.success("Supplier added")
      }
      setSupplierDialogOpen(false)
    } catch (e) {
      console.error(e)
      toast.error("Failed to save supplier")
    } finally {
      setSaving(false)
    }
  }

  const handleSaveOrder = async () => {
    const supplier = suppliers.find((s) => s.id === orderForm.supplierId)
    if (!supplier) {
      toast.error("Select a supplier")
      return
    }
    const validLines = orderForm.lines.filter((line) => line.product.trim())
    if (validLines.length === 0) {
      toast.error("Add at least one product (manual row or JSON import)")
      return
    }

    const defaultOrderDate = parseDateInput(orderForm.orderDate)
    if (!defaultOrderDate) {
      toast.error("Valid order date is required")
      return
    }

    const orderTag = orderForm.orderTag.trim()
    if (!orderTag) {
      toast.error("Order tag is required (e.g. order no. 123456 or brand TATA)")
      return
    }

    const orderId = crypto.randomUUID()

    try {
      setSaving(true)
      await createOrderItems(
        validLines.map((line) => {
          const mrp = Number(line.mrp) || 0
          const discountPercent = Number(line.discountPercent) || 0
          const deliveredDate = parseDateInput(line.deliveredDate)
          const lineOrderDate =
            parseDateInput(line.orderDate) ?? defaultOrderDate
          const lineOrderTag = line.orderTag.trim() || orderTag
          return {
            supplierId: supplier.id,
            supplierName: supplier.name,
            orderId,
            orderTag: lineOrderTag,
            product: line.product.trim(),
            brand: line.brand.trim(),
            buyRate: Number(line.buyRate) || 0,
            mrp,
            productId: line.productId.trim(),
            discountPercent,
            orderDate: lineOrderDate,
            deliveredDate,
          }
        })
      )
      toast.success(`Order saved (${validLines.length} items)`)
      setOrderDialogOpen(false)
    } catch (e) {
      console.error(e)
      toast.error("Failed to save order")
    } finally {
      setSaving(false)
    }
  }

  const handleSaveEditItem = async () => {
    if (!editingItem) return
    const supplier = suppliers.find((s) => s.id === editItemForm.supplierId)
    const orderDate = parseDateInput(editItemForm.orderDate)
    if (!supplier || !orderDate) {
      toast.error("Supplier and order date are required")
      return
    }
    if (!editItemForm.product.trim()) {
      toast.error("Product name is required")
      return
    }
    if (!editItemForm.orderTag.trim()) {
      toast.error("Order tag is required")
      return
    }

    try {
      setSaving(true)
      await editOrderItem(editingItem.id, {
        supplierId: supplier.id,
        supplierName: supplier.name,
        orderTag: editItemForm.orderTag.trim(),
        product: editItemForm.product.trim(),
        brand: editItemForm.brand.trim(),
        buyRate: Number(editItemForm.buyRate) || 0,
        mrp: Number(editItemForm.mrp) || 0,
        productId: editItemForm.productId.trim(),
        discountPercent: Number(editItemForm.discountPercent) || 0,
        orderDate,
        deliveredDate: parseDateInput(editItemForm.deliveredDate),
      })
      toast.success("Order item updated")
      setEditItemDialogOpen(false)
    } catch (e) {
      console.error(e)
      toast.error("Failed to update item")
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteSupplier = async (supplier: ProductSupplier) => {
    const linked = orderItems.some((i) => i.supplierId === supplier.id)
    const msg = linked
      ? `Delete "${supplier.name}"? Their past order rows will keep the supplier name but the supplier record will be removed.`
      : `Delete "${supplier.name}"?`
    if (!window.confirm(msg)) return
    try {
      await removeSupplier(supplier.id)
      toast.success("Supplier deleted")
    } catch (e) {
      console.error(e)
      toast.error("Failed to delete supplier")
    }
  }

  const handleDeleteItem = async (item: SupplierOrderItem) => {
    if (!window.confirm(`Remove "${item.product}" from orders?`)) return
    try {
      await removeOrderItem(item.id)
      setSelectedIds((prev) => {
        if (!prev.has(item.id)) return prev
        const next = new Set(prev)
        next.delete(item.id)
        return next
      })
      toast.success("Order item removed")
    } catch (e) {
      console.error(e)
      toast.error("Failed to delete item")
    }
  }

  const handleBulkDelete = async () => {
    const ids = [...selectedIds].filter((id) => orderItems.some((item) => item.id === id))
    if (ids.length === 0) return
    if (!window.confirm(`Delete ${ids.length} selected item${ids.length === 1 ? "" : "s"}?`)) return

    try {
      setBulkDeleting(true)
      await removeOrderItems(ids)
      setSelectedIds(new Set())
      toast.success(`Deleted ${ids.length} item${ids.length === 1 ? "" : "s"}`)
    } catch (e) {
      console.error(e)
      toast.error("Failed to delete selected items")
    } finally {
      setBulkDeleting(false)
    }
  }

  const updateOrderLine = (index: number, patch: Partial<OrderLineDraft>) => {
    setOrderForm((prev) => ({
      ...prev,
      lines: prev.lines.map((line, i) => (i === index ? { ...line, ...patch } : line)),
    }))
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">Procurement</p>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Product Suppliers</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Manage suppliers and create order lists. Each product line stores its own order date for
            search and sorting.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setManageSuppliersOpen(true)}>
            <Building2 className="mr-2 h-4 w-4" />
            Manage Suppliers ({suppliers.length})
          </Button>
          <Button variant="outline" onClick={openAddSupplier}>
            <Plus className="mr-2 h-4 w-4" />
            Add Supplier
          </Button>
          <Button onClick={openCreateOrder} disabled={suppliers.length === 0}>
            <Truck className="mr-2 h-4 w-4" />
            Create Order
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Suppliers</CardDescription>
            <CardTitle className="text-2xl">{suppliers.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Order line items</CardDescription>
            <CardTitle className="text-2xl">{orderItems.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Pending delivery</CardDescription>
            <CardTitle className="text-2xl">
              {orderItems.filter((i) => !i.deliveredDate).length}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Supplier Orders</CardTitle>
          <CardDescription>
            {filteredItems.length} of {orderItems.length} items
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search product, brand, order tag, supplier..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={supplierFilter} onValueChange={setSupplierFilter}>
              <SelectTrigger className="w-full lg:w-[220px]">
                <SelectValue placeholder="All suppliers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All suppliers</SelectItem>
                {suppliers.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={orderTagFilter} onValueChange={setOrderTagFilter}>
              <SelectTrigger className="w-full lg:w-[200px]">
                <SelectValue placeholder="All order tags" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All order tags</SelectItem>
                {availableOrderTags.map((tag) => (
                  <SelectItem key={tag} value={tag}>
                    {tag === UNTAGGED_ORDER ? "No tag" : tag}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={sortKey} onValueChange={(v) => setSortKey(v as SortKey)}>
              <SelectTrigger className="w-full lg:w-[220px]">
                <ArrowDownUp className="mr-2 h-4 w-4" />
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="orderDate-desc">Recent orders first</SelectItem>
                <SelectItem value="orderDate-asc">Oldest orders first</SelectItem>
                <SelectItem value="orderTag-asc">Order tag (A–Z)</SelectItem>
                <SelectItem value="supplier-asc">Supplier name (A–Z)</SelectItem>
                <SelectItem value="product-asc">Product name (A–Z)</SelectItem>
                <SelectItem value="delivered-desc">Recently delivered</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {selectedCount > 0 && (
            <div className="flex flex-wrap items-center gap-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
              <span className="text-sm font-medium">
                {selectedCount} item{selectedCount === 1 ? "" : "s"} selected
              </span>
              <Button variant="outline" size="sm" onClick={clearSelection} disabled={bulkDeleting}>
                Clear selection
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => void handleBulkDelete()}
                disabled={bulkDeleting}
              >
                {bulkDeleting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="mr-2 h-4 w-4" />
                )}
                Delete selected
              </Button>
            </div>
          )}

          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={allFilteredSelected ? true : someFilteredSelected ? "indeterminate" : false}
                      onCheckedChange={(checked) => toggleSelectAllFiltered(checked === true)}
                      aria-label="Select all visible items"
                      disabled={filteredItems.length === 0 || bulkDeleting}
                    />
                  </TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Order Tag</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Brand</TableHead>
                  <TableHead className="text-right">Buy Rate</TableHead>
                  <TableHead className="text-right">MRP</TableHead>
                  <TableHead>Product ID</TableHead>
                  <TableHead className="text-right">Discount %</TableHead>
                  <TableHead className="text-right">Sale Rate</TableHead>
                  <TableHead>Order Date</TableHead>
                  <TableHead>Delivered Date</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={13} className="h-32 text-center text-muted-foreground">
                      {suppliers.length === 0
                        ? "Add a supplier first, then create an order list."
                        : "No order items match your filters."}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredItems.map((item) => {
                    const isSelected = selectedIds.has(item.id)
                    return (
                    <TableRow
                      key={item.id}
                      className={cn(isSelected && "bg-primary/5")}
                      data-state={isSelected ? "selected" : undefined}
                    >
                      <TableCell>
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={(checked) => toggleSelectItem(item.id, checked === true)}
                          aria-label={`Select ${item.product}`}
                          disabled={bulkDeleting}
                        />
                      </TableCell>
                      <TableCell className="font-medium">{item.supplierName}</TableCell>
                      <TableCell>
                        {item.orderTag?.trim() ? (
                          <Badge variant="secondary" className="font-mono text-xs">
                            {item.orderTag}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>{item.product}</TableCell>
                      <TableCell>{item.brand || "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCurrency(item.buyRate)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCurrency(item.mrp)}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{item.productId || "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">{item.discountPercent}%</TableCell>
                      <TableCell className="text-right tabular-nums font-medium">
                        {formatCurrency(item.saleRate)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {format(item.orderDate, "dd MMM yyyy")}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {item.deliveredDate ? (
                          format(item.deliveredDate, "dd MMM yyyy")
                        ) : (
                          <Badge variant="outline" className="text-amber-600 border-amber-500/30">
                            Pending
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEditItem(item)}>
                              <Pencil className="mr-2 h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => void handleDeleteItem(item)}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
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
        </CardContent>
      </Card>

      {/* Add / Edit Supplier */}
      <Dialog open={supplierDialogOpen} onOpenChange={setSupplierDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingSupplier ? "Edit Supplier" : "Add Supplier"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="supplier-name">Name *</Label>
              <Input
                id="supplier-name"
                value={supplierForm.name}
                onChange={(e) => setSupplierForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="e.g. ABC Distributors"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="supplier-phone">Phone</Label>
                <Input
                  id="supplier-phone"
                  value={supplierForm.phone}
                  onChange={(e) => setSupplierForm((p) => ({ ...p, phone: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="supplier-email">Email</Label>
                <Input
                  id="supplier-email"
                  type="email"
                  value={supplierForm.email}
                  onChange={(e) => setSupplierForm((p) => ({ ...p, email: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="supplier-address">Address</Label>
              <Input
                id="supplier-address"
                value={supplierForm.address}
                onChange={(e) => setSupplierForm((p) => ({ ...p, address: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="supplier-notes">Notes</Label>
              <Textarea
                id="supplier-notes"
                value={supplierForm.notes}
                onChange={(e) => setSupplierForm((p) => ({ ...p, notes: e.target.value }))}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSupplierDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void handleSaveSupplier()} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manage Suppliers list */}
      <Dialog open={manageSuppliersOpen} onOpenChange={setManageSuppliersOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Suppliers</DialogTitle>
          </DialogHeader>
          <div className="max-h-[360px] space-y-2 overflow-y-auto py-2">
            {suppliers.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No suppliers yet.</p>
            ) : (
              suppliers.map((supplier) => (
                <div
                  key={supplier.id}
                  className="flex items-start justify-between gap-3 rounded-lg border p-3"
                >
                  <div className="min-w-0">
                    <p className="font-medium">{supplier.name}</p>
                    {supplier.phone && (
                      <p className="text-xs text-muted-foreground">{supplier.phone}</p>
                    )}
                    {supplier.email && (
                      <p className="text-xs text-muted-foreground">{supplier.email}</p>
                    )}
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEditSupplier(supplier)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive"
                      onClick={() => void handleDeleteSupplier(supplier)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setManageSuppliersOpen(false)}>
              Close
            </Button>
            <Button
              onClick={() => {
                setManageSuppliersOpen(false)
                openAddSupplier()
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Supplier
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Order */}
      <Dialog open={orderDialogOpen} onOpenChange={setOrderDialogOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Supplier Order</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label>Supplier *</Label>
                <Select
                  value={orderForm.supplierId}
                  onValueChange={(v) => setOrderForm((p) => ({ ...p, supplierId: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select supplier" />
                  </SelectTrigger>
                  <SelectContent>
                    {suppliers.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="order-tag">Order tag *</Label>
                <Input
                  id="order-tag"
                  value={orderForm.orderTag}
                  onChange={(e) => setOrderForm((p) => ({ ...p, orderTag: e.target.value }))}
                  placeholder="e.g. 123456 or TATA"
                />
                <p className="text-xs text-muted-foreground">
                  Label this order under the supplier — order no., brand, batch name, etc.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="order-date">Order Date *</Label>
                <Input
                  id="order-date"
                  type="date"
                  value={orderForm.orderDate}
                  onChange={(e) => setOrderForm((p) => ({ ...p, orderDate: e.target.value }))}
                />
              </div>
            </div>

            <Tabs value={orderEntryTab} onValueChange={(v) => setOrderEntryTab(v as OrderEntryTab)}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <TabsList>
                  <TabsTrigger value="manual">Manual rows</TabsTrigger>
                  <TabsTrigger value="json" className="gap-1.5">
                    <FileJson className="h-3.5 w-3.5" />
                    JSON import
                  </TabsTrigger>
                </TabsList>
                {orderForm.lines.filter((l) => l.product.trim()).length > 0 && (
                  <Badge variant="secondary">
                    {orderForm.lines.filter((l) => l.product.trim()).length} items ready
                  </Badge>
                )}
              </div>

              <TabsContent value="manual" className="mt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Order items</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setOrderForm((p) => ({ ...p, lines: [...p.lines, emptyOrderLine()] }))
                    }
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add row
                  </Button>
                </div>

                {orderForm.lines.filter((l) => l.product.trim()).length >
                  MANUAL_ROW_PREVIEW_LIMIT && (
                  <p className="text-xs text-muted-foreground rounded-md border border-dashed px-3 py-2">
                    Large list ({orderForm.lines.length} rows) — use the{" "}
                    <button
                      type="button"
                      className="font-medium text-primary underline-offset-2 hover:underline"
                      onClick={() => setOrderEntryTab("json")}
                    >
                      JSON import
                    </button>{" "}
                    tab for bulk entry. Showing first {MANUAL_ROW_PREVIEW_LIMIT} rows below.
                  </p>
                )}

                {orderForm.lines.slice(0, MANUAL_ROW_PREVIEW_LIMIT).map((line, index) => {
                  const mrp = Number(line.mrp) || 0
                  const discount = Number(line.discountPercent) || 0
                  const saleRate = computeSaleRate(mrp, discount)
                  return (
                    <div
                      key={index}
                      className="grid gap-2 rounded-lg border p-3 sm:grid-cols-2 lg:grid-cols-4"
                    >
                      <Input
                        placeholder="Product *"
                        value={line.product}
                        onChange={(e) => updateOrderLine(index, { product: e.target.value })}
                      />
                      <Input
                        placeholder="Brand"
                        value={line.brand}
                        onChange={(e) => updateOrderLine(index, { brand: e.target.value })}
                      />
                      <Input
                        placeholder="Product ID"
                        value={line.productId}
                        onChange={(e) => updateOrderLine(index, { productId: e.target.value })}
                      />
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="Buy rate"
                        value={line.buyRate}
                        onChange={(e) => updateOrderLine(index, { buyRate: e.target.value })}
                      />
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="MRP"
                        value={line.mrp}
                        onChange={(e) => updateOrderLine(index, { mrp: e.target.value })}
                      />
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        placeholder="Discount %"
                        value={line.discountPercent}
                        onChange={(e) =>
                          updateOrderLine(index, { discountPercent: e.target.value })
                        }
                      />
                      <Input
                        readOnly
                        value={saleRate > 0 ? formatCurrency(saleRate) : "Sale rate"}
                        className="bg-muted/50"
                      />
                      <div className="flex gap-2">
                        <Input
                          type="date"
                          title="Delivered date"
                          value={line.deliveredDate}
                          onChange={(e) =>
                            updateOrderLine(index, { deliveredDate: e.target.value })
                          }
                        />
                        {orderForm.lines.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="shrink-0 text-destructive"
                            onClick={() =>
                              setOrderForm((p) => ({
                                ...p,
                                lines: p.lines.filter((_, i) => i !== index),
                              }))
                            }
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </TabsContent>

              <TabsContent value="json" className="mt-4 space-y-4">
                <div className="rounded-lg border bg-muted/30 px-3 py-2 text-xs font-mono leading-relaxed text-muted-foreground overflow-x-auto">
                  {SUPPLIER_ORDER_JSON_EXAMPLE}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <input
                    ref={jsonFileRef}
                    type="file"
                    accept=".json,application/json"
                    className="hidden"
                    onChange={handleJsonFileUpload}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => jsonFileRef.current?.click()}
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    Upload JSON file
                  </Button>
                  <span className="text-xs text-muted-foreground">or paste below</span>
                  {jsonPreviewLines && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setJsonText("")
                        setJsonError("")
                        setJsonPreviewLines(null)
                        setOrderForm((p) => ({ ...p, lines: [emptyOrderLine()] }))
                      }}
                    >
                      Clear import
                    </Button>
                  )}
                </div>

                <Textarea
                  placeholder="Paste JSON array here…"
                  className="min-h-[160px] font-mono text-sm resize-y"
                  value={jsonText}
                  onChange={(e) => {
                    const text = e.target.value
                    setJsonText(text)
                    if (!text.trim()) {
                      setJsonError("")
                      setJsonPreviewLines(null)
                      return
                    }
                    applyParsedJson(text)
                  }}
                />

                <p className="text-xs text-muted-foreground">
                  Accepted fields:{" "}
                  <span className="font-mono">
                    order_tag, product, brand, buy_rate, mrp, product_id, discount_percent,
                    order_date, delivered_date
                  </span>{" "}
                  (snake_case or camelCase). Use a wrapper object with{" "}
                  <span className="font-mono">order_tag</span> +{" "}
                  <span className="font-mono">items</span> array for bulk import.
                </p>

                {jsonError && (
                  <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    {jsonError}
                  </div>
                )}

                {jsonPreviewLines && jsonPreviewLines.length > 0 && (
                  <div className="space-y-2">
                    <Label>Preview ({jsonPreviewLines.length} items)</Label>
                    <div className="max-h-64 overflow-auto rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Product</TableHead>
                            <TableHead>Brand</TableHead>
                            <TableHead className="text-right">Buy</TableHead>
                            <TableHead className="text-right">MRP</TableHead>
                            <TableHead>ID</TableHead>
                            <TableHead className="text-right">Disc %</TableHead>
                            <TableHead className="text-right">Sale</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {jsonPreviewLines.slice(0, 50).map((line, i) => (
                            <TableRow key={i}>
                              <TableCell className="max-w-[140px] truncate">{line.product}</TableCell>
                              <TableCell>{line.brand || "—"}</TableCell>
                              <TableCell className="text-right tabular-nums">
                                {line.buyRate || "—"}
                              </TableCell>
                              <TableCell className="text-right tabular-nums">{line.mrp || "—"}</TableCell>
                              <TableCell className="font-mono text-xs">{line.productId || "—"}</TableCell>
                              <TableCell className="text-right">{line.discountPercent}%</TableCell>
                              <TableCell className="text-right tabular-nums">
                                {formatCurrency(
                                  computeSaleRate(
                                    Number(line.mrp) || 0,
                                    Number(line.discountPercent) || 0
                                  )
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    {jsonPreviewLines.length > 50 && (
                      <p className="text-xs text-muted-foreground">
                        Showing first 50 of {jsonPreviewLines.length} items. All will be saved.
                      </p>
                    )}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOrderDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void handleSaveOrder()} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Order
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit single order item */}
      <Dialog open={editItemDialogOpen} onOpenChange={setEditItemDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Order Item</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Supplier</Label>
              <Select
                value={editItemForm.supplierId}
                onValueChange={(v) => setEditItemForm((p) => ({ ...p, supplierId: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Order tag *</Label>
              <Input
                value={editItemForm.orderTag}
                onChange={(e) => setEditItemForm((p) => ({ ...p, orderTag: e.target.value }))}
                placeholder="e.g. 123456 or TATA"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Product *</Label>
                <Input
                  value={editItemForm.product}
                  onChange={(e) => setEditItemForm((p) => ({ ...p, product: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Brand</Label>
                <Input
                  value={editItemForm.brand}
                  onChange={(e) => setEditItemForm((p) => ({ ...p, brand: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Product ID</Label>
                <Input
                  value={editItemForm.productId}
                  onChange={(e) => setEditItemForm((p) => ({ ...p, productId: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Buy Rate</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={editItemForm.buyRate}
                  onChange={(e) => setEditItemForm((p) => ({ ...p, buyRate: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label>MRP</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={editItemForm.mrp}
                  onChange={(e) => setEditItemForm((p) => ({ ...p, mrp: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Discount %</Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={editItemForm.discountPercent}
                  onChange={(e) =>
                    setEditItemForm((p) => ({ ...p, discountPercent: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Sale Rate</Label>
                <Input
                  readOnly
                  className="bg-muted/50"
                  value={formatCurrency(
                    computeSaleRate(
                      Number(editItemForm.mrp) || 0,
                      Number(editItemForm.discountPercent) || 0
                    )
                  )}
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Order Date</Label>
                <Input
                  type="date"
                  value={editItemForm.orderDate}
                  onChange={(e) => setEditItemForm((p) => ({ ...p, orderDate: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Delivered Date</Label>
                <Input
                  type="date"
                  value={editItemForm.deliveredDate}
                  onChange={(e) =>
                    setEditItemForm((p) => ({ ...p, deliveredDate: e.target.value }))
                  }
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditItemDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void handleSaveEditItem()} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
