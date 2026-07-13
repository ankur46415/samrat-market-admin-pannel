"use client"

import { useState, useRef } from "react"
import {
  ShoppingBag,
  Plus,
  Trash2,
  Pencil,
  ChevronRight,
  Upload,
  X,
  Check,
  AlertCircle,
  Loader2,
  CheckCircle2,
  Cloud,
  Package,
  IndianRupee,
  Layers,
  ArrowLeft,
  FileJson,
  Search,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { usePurchaseCatalog } from "@/hooks/use-purchase-catalog"
import type { CatalogProduct, PurchaseCatalog } from "@/lib/features/purchase-catalog/models"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import type { CatalogSyncStatus } from "@/hooks/use-purchase-catalog"

// ─── Color palette for catalog cards ─────────────────────────────────────────
const CARD_COLORS = [
  { label: "Indigo", value: "#6366f1" },
  { label: "Violet", value: "#8b5cf6" },
  { label: "Sky", value: "#0ea5e9" },
  { label: "Teal", value: "#14b8a6" },
  { label: "Emerald", value: "#10b981" },
  { label: "Orange", value: "#f97316" },
  { label: "Rose", value: "#f43f5e" },
  { label: "Amber", value: "#f59e0b" },
]

// ─── Sync badge ───────────────────────────────────────────────────────────────
function SyncBadge({ status }: { status: CatalogSyncStatus }) {
  const cfg: Record<CatalogSyncStatus, { text: string; icon: typeof Cloud; variant: "secondary" | "outline" | "destructive" }> = {
    connecting: { text: "Connecting…", icon: Loader2, variant: "secondary" },
    synced: { text: "Synced", icon: CheckCircle2, variant: "secondary" },
    error: { text: "Sync error", icon: AlertCircle, variant: "destructive" },
    offline: { text: "Offline", icon: Cloud, variant: "secondary" },
  }
  const { text, icon: Icon, variant } = cfg[status] ?? cfg.offline
  return (
    <Badge variant={variant} className="gap-1.5 px-3 py-1.5 text-xs font-medium">
      <Icon className={cn("h-3.5 w-3.5", status === "connecting" && "animate-spin")} />
      {text}
    </Badge>
  )
}

// ─── Catalog Group Card ───────────────────────────────────────────────────────
function CatalogCard({
  catalog,
  onClick,
  onEdit,
  onDelete,
}: {
  catalog: PurchaseCatalog
  onClick: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  const color = catalog.color ?? "#6366f1"
  return (
    <div
      className="group relative rounded-2xl border border-slate-200 bg-white shadow-md hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer overflow-hidden"
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onClick()}
    >
      {/* Color accent top strip */}
      <div className="h-2 w-full" style={{ backgroundColor: color }} />

      <div className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl shadow-sm"
              style={{ backgroundColor: `${color}22` }}
            >
              <Package className="h-5 w-5" style={{ color }} />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-slate-800 text-base leading-snug truncate">{catalog.name}</h3>
              {catalog.source && (
                <p className="text-xs font-medium text-slate-500 mt-0.5 truncate">{catalog.source}</p>
              )}
            </div>
          </div>

          {/* Action buttons — visible on hover */}
          <div
            className="flex shrink-0 gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
              onClick={onEdit}
              title="Edit catalog"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors"
              onClick={onDelete}
              title="Delete catalog"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Stats row */}
        <div className="mt-4 grid grid-cols-3 gap-2">
          <div className="rounded-lg bg-slate-50 px-3 py-2 text-center border border-slate-100">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Items</p>
            <p className="text-lg font-black text-slate-800">{catalog.products.length}</p>
          </div>
          <div className="rounded-lg px-3 py-2 text-center border" style={{ backgroundColor: `${color}11`, borderColor: `${color}33` }}>
            <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color }}>Min Price</p>
            <p className="text-sm font-black text-slate-800">
              ₹{catalog.products.length > 0 ? Math.min(...catalog.products.map((p) => p.price)) : "—"}
            </p>
          </div>
          <div className="rounded-lg px-3 py-2 text-center border" style={{ backgroundColor: `${color}11`, borderColor: `${color}33` }}>
            <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color }}>Max Price</p>
            <p className="text-sm font-black text-slate-800">
              ₹{catalog.products.length > 0 ? Math.max(...catalog.products.map((p) => p.price)) : "—"}
            </p>
          </div>
        </div>

        {/* Footer arrow */}
        <div className="mt-3 flex items-center gap-1 text-xs font-semibold" style={{ color }}>
          <span>View all products</span>
          <ChevronRight className="h-3.5 w-3.5" />
        </div>
      </div>
    </div>
  )
}

// ─── Product Detail Row ───────────────────────────────────────────────────────
function ProductRow({
  product,
  index,
  onEdit,
  onDelete,
}: {
  product: CatalogProduct
  index: number
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <tr className="group border-b border-slate-100 hover:bg-indigo-50/40 transition-colors">
      <td className="py-3 pl-4 pr-2 text-sm font-medium text-slate-400 w-10">{index + 1}</td>
      <td className="py-3 px-3 text-sm font-semibold text-slate-800">{product.product_name}</td>
      <td className="py-3 px-3 text-sm text-slate-600">{product.brand ?? "—"}</td>
      <td className="py-3 px-3 text-sm font-bold text-emerald-700">
        ₹{product.price.toLocaleString("en-IN")}
      </td>
      <td className="py-3 px-3 text-sm text-slate-600">×{product.moq}</td>
      <td className="py-3 px-3 text-sm text-slate-500">{product.unit ?? "—"}</td>
      <td className="py-3 pl-3 pr-4 text-right">
        <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            className="rounded p-1 text-slate-400 hover:bg-white hover:text-slate-700 hover:shadow-sm transition-all"
            onClick={onEdit}
            title="Edit product"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-500 hover:shadow-sm transition-all"
            onClick={onDelete}
            title="Delete product"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </td>
    </tr>
  )
}

// ─── Add/Edit Catalog Dialog ──────────────────────────────────────────────────
function CatalogDialog({
  open,
  onClose,
  onSave,
  initial,
}: {
  open: boolean
  onClose: () => void
  onSave: (name: string, source: string, color: string) => Promise<void>
  initial?: PurchaseCatalog | null
}) {
  const [name, setName] = useState(initial?.name ?? "")
  const [source, setSource] = useState(initial?.source ?? "")
  const [color, setColor] = useState(initial?.color ?? CARD_COLORS[0].value)
  const [saving, setSaving] = useState(false)

  // Reset on open
  const handleOpenChange = (o: boolean) => {
    if (!o) {
      setName(initial?.name ?? "")
      setSource(initial?.source ?? "")
      setColor(initial?.color ?? CARD_COLORS[0].value)
      onClose()
    }
  }

  const handleSave = async () => {
    if (!name.trim()) return
    setSaving(true)
    try {
      await onSave(name.trim(), source.trim(), color)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{initial ? "Edit Catalog Group" : "New Catalog Group"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="cat-name">Group Name *</Label>
            <Input
              id="cat-name"
              placeholder="e.g. Pencil Sharpeners"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cat-source">Source / Agency Name</Label>
            <Input
              id="cat-source"
              placeholder="e.g. Faber-Castell Agency, Delhi"
              value={source}
              onChange={(e) => setSource(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Card Color</Label>
            <div className="flex flex-wrap gap-2">
              {CARD_COLORS.map((c) => (
                <button
                  key={c.value}
                  className={cn(
                    "h-8 w-8 rounded-full border-2 transition-all",
                    color === c.value ? "border-slate-800 scale-110 shadow-md" : "border-transparent hover:scale-105"
                  )}
                  style={{ backgroundColor: c.value }}
                  onClick={() => setColor(c.value)}
                  title={c.label}
                />
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button onClick={handleSave} disabled={!name.trim() || saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {initial ? "Save Changes" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Add/Edit Single Product Dialog ──────────────────────────────────────────
function ProductDialog({
  open,
  onClose,
  onSave,
  initial,
}: {
  open: boolean
  onClose: () => void
  onSave: (product: CatalogProduct) => Promise<void>
  initial?: CatalogProduct | null
}) {
  const [productName, setProductName] = useState(initial?.product_name ?? "")
  const [price, setPrice] = useState(initial?.price?.toString() ?? "")
  const [moq, setMoq] = useState(initial?.moq?.toString() ?? "")
  const [brand, setBrand] = useState(initial?.brand ?? "")
  const [unit, setUnit] = useState(initial?.unit ?? "")
  const [notes, setNotes] = useState(initial?.notes ?? "")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  const handleOpenChange = (o: boolean) => {
    if (!o) {
      setProductName(initial?.product_name ?? "")
      setPrice(initial?.price?.toString() ?? "")
      setMoq(initial?.moq?.toString() ?? "")
      setBrand(initial?.brand ?? "")
      setUnit(initial?.unit ?? "")
      setNotes(initial?.notes ?? "")
      setError("")
      onClose()
    }
  }

  const handleSave = async () => {
    if (!productName.trim()) { setError("Product name required"); return }
    if (!price || isNaN(Number(price))) { setError("Valid price required"); return }
    if (!moq || isNaN(Number(moq))) { setError("Valid MOQ required"); return }
    setSaving(true)
    setError("")
    try {
      await onSave({
        product_name: productName.trim(),
        price: Number(price),
        moq: Number(moq),
        brand: brand.trim() || undefined,
        unit: unit.trim() || undefined,
        notes: notes.trim() || undefined,
      })
      onClose()
    } catch {
      setError("Failed to save")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{initial ? "Edit Product" : "Add Product"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="prod-name">Product Name *</Label>
            <Input id="prod-name" placeholder="e.g. Cup Shape Pencil Sharpener" value={productName} onChange={(e) => setProductName(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="prod-price">Price (₹) *</Label>
              <Input id="prod-price" type="number" min={0} placeholder="18" value={price} onChange={(e) => setPrice(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="prod-moq">MOQ *</Label>
              <Input id="prod-moq" type="number" min={1} placeholder="24" value={moq} onChange={(e) => setMoq(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="prod-brand">Brand</Label>
              <Input id="prod-brand" placeholder="e.g. Apsara" value={brand} onChange={(e) => setBrand(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="prod-unit">Unit</Label>
              <Input id="prod-unit" placeholder="e.g. pcs, box" value={unit} onChange={(e) => setUnit(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="prod-notes">Notes</Label>
            <Input id="prod-notes" placeholder="Any extra info…" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {initial ? "Save" : "Add Product"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── JSON Import Dialog ───────────────────────────────────────────────────────
function JsonImportDialog({
  open,
  onClose,
  onImport,
}: {
  open: boolean
  onClose: () => void
  onImport: (products: CatalogProduct[]) => void
}) {
  const [json, setJson] = useState("")
  const [error, setError] = useState("")
  const [preview, setPreview] = useState<CatalogProduct[] | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const reset = () => {
    setJson("")
    setError("")
    setPreview(null)
  }

  const parseJson = (raw: string) => {
    setError("")
    setPreview(null)
    try {
      // Allow trailing commas by removing them before last ] or }
      const cleaned = raw.replace(/,\s*([\]}])/g, "$1")
      const parsed = JSON.parse(cleaned)
      const arr: CatalogProduct[] = Array.isArray(parsed) ? parsed : [parsed]
      // Validate each entry
      const valid = arr.every(
        (item) =>
          typeof item.product_name === "string" &&
          typeof item.price === "number" &&
          typeof item.moq === "number"
      )
      if (!valid) {
        setError("Each item must have: product_name (string), price (number), moq (number)")
        return
      }
      setPreview(arr)
    } catch {
      setError("Invalid JSON — please check the format")
    }
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      setJson(text)
      parseJson(text)
    }
    reader.readAsText(file)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) { reset(); onClose() }
      }}
    >
      <DialogContent className="max-w-2xl flex flex-col max-h-[90vh]">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <FileJson className="h-5 w-5 text-indigo-600" />
            Import Products via JSON
          </DialogTitle>
        </DialogHeader>

        {/* Scrollable content area */}
        <div className="flex-1 overflow-y-auto space-y-4 py-2 pr-1">
          {/* Format hint */}
          <div className="rounded-xl bg-indigo-50 border border-indigo-100 px-4 py-3 text-xs text-indigo-700 font-mono leading-relaxed">
            {`[ { "product_name": "Cup Shape Pencil Sharpener", "price": 18, "moq": 24 }, ... ]`}
          </div>

          <div className="flex items-center gap-2">
            <input
              ref={fileRef}
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={handleFileUpload}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileRef.current?.click()}
              className="gap-2"
            >
              <Upload className="h-3.5 w-3.5" />
              Upload JSON File
            </Button>
            <span className="text-xs text-slate-400">or paste below</span>
          </div>

          <Textarea
            placeholder='Paste your JSON here…'
            className="min-h-[160px] font-mono text-sm resize-none"
            value={json}
            onChange={(e) => {
              setJson(e.target.value)
              if (e.target.value.trim()) parseJson(e.target.value)
              else { setPreview(null); setError("") }
            }}
          />

          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          {preview && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 px-4 py-3">
              <div className="flex items-center gap-2 mb-2">
                <Check className="h-4 w-4 text-emerald-600" />
                <span className="text-sm font-bold text-emerald-700">{preview.length} products ready to import</span>
              </div>
              <div className="max-h-32 overflow-y-auto space-y-0.5">
                {preview.map((p, i) => (
                  <div key={i} className="text-xs text-emerald-700 font-medium">
                    {i + 1}. {p.product_name} — ₹{p.price} × MOQ {p.moq}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer always pinned to bottom */}
        <DialogFooter className="shrink-0 border-t border-slate-100 pt-4 mt-0">
          <DialogClose asChild>
            <Button variant="outline" onClick={reset}>Cancel</Button>
          </DialogClose>
          <Button
            disabled={!preview || preview.length === 0}
            onClick={() => {
              if (preview) {
                onImport(preview)
                reset()
                onClose()
              }
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            Import {preview ? `${preview.length} Products` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Delete Confirm Dialog ────────────────────────────────────────────────────
function ConfirmDeleteDialog({
  open,
  title,
  message,
  onConfirm,
  onClose,
}: {
  open: boolean
  title: string
  message: string
  onConfirm: () => Promise<void>
  onClose: () => void
}) {
  const [deleting, setDeleting] = useState(false)
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-red-600">{title}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-slate-600 py-2">{message}</p>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button
            variant="destructive"
            disabled={deleting}
            onClick={async () => {
              setDeleting(true)
              await onConfirm()
              setDeleting(false)
              onClose()
            }}
          >
            {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Catalog Detail View (Products table) ─────────────────────────────────────
function CatalogDetailView({
  catalog,
  onBack,
  onUpdateProducts,
}: {
  catalog: PurchaseCatalog
  onBack: () => void
  onUpdateProducts: (products: CatalogProduct[]) => Promise<void>
}) {
  const [products, setProducts] = useState<CatalogProduct[]>(catalog.products)
  const [productDialogOpen, setProductDialogOpen] = useState(false)
  const [jsonImportOpen, setJsonImportOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<{ product: CatalogProduct; index: number } | null>(null)
  const [deletingIndex, setDeletingIndex] = useState<number | null>(null)
  const [search, setSearch] = useState("")
  const [saving, setSaving] = useState(false)

  const color = catalog.color ?? "#6366f1"

  // Keep local products in sync if catalog prop changes
  const syncProducts = async (updated: CatalogProduct[]) => {
    setProducts(updated)
    setSaving(true)
    try {
      await onUpdateProducts(updated)
    } finally {
      setSaving(false)
    }
  }

  const handleAddProduct = async (product: CatalogProduct) => {
    await syncProducts([...products, product])
  }

  const handleEditProduct = async (product: CatalogProduct) => {
    if (editingProduct === null) return
    const updated = products.map((p, i) => (i === editingProduct.index ? product : p))
    await syncProducts(updated)
    setEditingProduct(null)
  }

  const handleDeleteProduct = async (index: number) => {
    const updated = products.filter((_, i) => i !== index)
    await syncProducts(updated)
    setDeletingIndex(null)
  }

  const handleJsonImport = async (imported: CatalogProduct[]) => {
    // Merge: avoid exact duplicates by product_name
    const existing = new Set(products.map((p) => p.product_name.toLowerCase()))
    const newOnes = imported.filter((p) => !existing.has(p.product_name.toLowerCase()))
    const merged = [...products, ...newOnes]
    await syncProducts(merged)
  }

  const filtered = products.filter((p) =>
    p.product_name.toLowerCase().includes(search.toLowerCase()) ||
    (p.brand ?? "").toLowerCase().includes(search.toLowerCase())
  )

  const totalMOQValue = products.reduce((sum, p) => sum + p.price * p.moq, 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 border-b pb-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <Button variant="ghost" size="sm" onClick={onBack} className="shrink-0 gap-1.5 text-slate-500 hover:text-slate-800">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl shadow-sm"
            style={{ backgroundColor: `${color}22` }}
          >
            <Package className="h-5 w-5" style={{ color }} />
          </div>
          <div className="min-w-0">
            <h2 className="text-xl font-bold text-slate-900 truncate">{catalog.name}</h2>
            {catalog.source && <p className="text-sm text-slate-500 truncate">{catalog.source}</p>}
          </div>
        </div>

        <div className="flex flex-wrap shrink-0 gap-2">
          {saving && (
            <Badge variant="secondary" className="gap-1.5">
              <Loader2 className="h-3 w-3 animate-spin" />
              Saving…
            </Badge>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setJsonImportOpen(true)}
            className="gap-2 border-indigo-200 text-indigo-700 hover:bg-indigo-50"
          >
            <FileJson className="h-3.5 w-3.5" />
            Import JSON
          </Button>
          <Button
            size="sm"
            onClick={() => { setEditingProduct(null); setProductDialogOpen(true) }}
            className="gap-2"
            style={{ backgroundColor: color }}
          >
            <Plus className="h-3.5 w-3.5" />
            Add Product
          </Button>
        </div>
      </div>

      {/* KPI bar */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Total Products", value: products.length, icon: Package, color: "#6366f1" },
          { label: "Min Price", value: products.length > 0 ? `₹${Math.min(...products.map((p) => p.price))}` : "—", icon: IndianRupee, color: "#10b981" },
          { label: "Max Price", value: products.length > 0 ? `₹${Math.max(...products.map((p) => p.price))}` : "—", icon: IndianRupee, color: "#f97316" },
          { label: "MOQ × Price Total", value: `₹${totalMOQValue.toLocaleString("en-IN")}`, icon: Layers, color: color },
        ].map((kpi) => {
          const Icon = kpi.icon
          return (
            <div key={kpi.label} className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-1">
                <Icon className="h-3.5 w-3.5" style={{ color: kpi.color }} />
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{kpi.label}</span>
              </div>
              <p className="text-xl font-black text-slate-800">{kpi.value}</p>
            </div>
          )
        })}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input
          placeholder="Search products…"
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Products table */}
      <Card className="border-slate-200 shadow-md overflow-hidden">
        {products.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
            <div
              className="flex h-16 w-16 items-center justify-center rounded-2xl"
              style={{ backgroundColor: `${color}15` }}
            >
              <Package className="h-7 w-7" style={{ color }} />
            </div>
            <div>
              <p className="font-bold text-slate-700">No products yet</p>
              <p className="text-sm text-slate-400 mt-1">Add products manually or import via JSON</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setJsonImportOpen(true)} className="gap-2">
                <FileJson className="h-3.5 w-3.5" />
                Import JSON
              </Button>
              <Button size="sm" onClick={() => setProductDialogOpen(true)} className="gap-2" style={{ backgroundColor: color }}>
                <Plus className="h-3.5 w-3.5" />
                Add Product
              </Button>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="py-3 pl-4 pr-2 text-xs font-bold uppercase tracking-wider text-slate-400 w-10">#</th>
                  <th className="py-3 px-3 text-xs font-bold uppercase tracking-wider text-slate-500">Product Name</th>
                  <th className="py-3 px-3 text-xs font-bold uppercase tracking-wider text-slate-500">Brand</th>
                  <th className="py-3 px-3 text-xs font-bold uppercase tracking-wider text-slate-500">Price</th>
                  <th className="py-3 px-3 text-xs font-bold uppercase tracking-wider text-slate-500">MOQ</th>
                  <th className="py-3 px-3 text-xs font-bold uppercase tracking-wider text-slate-500">Unit</th>
                  <th className="py-3 pl-3 pr-4 text-xs font-bold uppercase tracking-wider text-slate-400 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((product, i) => {
                  const realIndex = products.indexOf(product)
                  return (
                    <ProductRow
                      key={i}
                      product={product}
                      index={i}
                      onEdit={() => {
                        setEditingProduct({ product, index: realIndex })
                        setProductDialogOpen(true)
                      }}
                      onDelete={() => setDeletingIndex(realIndex)}
                    />
                  )
                })}
              </tbody>
            </table>
            {filtered.length === 0 && (
              <div className="py-8 text-center text-sm text-slate-400">No products match your search</div>
            )}
          </div>
        )}
      </Card>

      {/* Dialogs */}
      <ProductDialog
        open={productDialogOpen}
        onClose={() => { setProductDialogOpen(false); setEditingProduct(null) }}
        onSave={editingProduct ? handleEditProduct : handleAddProduct}
        initial={editingProduct?.product ?? null}
      />

      <JsonImportDialog
        open={jsonImportOpen}
        onClose={() => setJsonImportOpen(false)}
        onImport={handleJsonImport}
      />

      {deletingIndex !== null && (
        <ConfirmDeleteDialog
          open
          title="Delete Product"
          message={`Delete "${products[deletingIndex]?.product_name}"? This cannot be undone.`}
          onConfirm={() => handleDeleteProduct(deletingIndex)}
          onClose={() => setDeletingIndex(null)}
        />
      )}
    </div>
  )
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export function PurchaseCatalogDashboard() {
  const { catalogs, loading, syncStatus, createCatalog, updateCatalogMeta, updateCatalogProducts, removeCatalog } =
    usePurchaseCatalog()

  const [selectedCatalog, setSelectedCatalog] = useState<PurchaseCatalog | null>(null)
  const [catalogDialogOpen, setCatalogDialogOpen] = useState(false)
  const [editingCatalog, setEditingCatalog] = useState<PurchaseCatalog | null>(null)
  const [deletingCatalogId, setDeletingCatalogId] = useState<string | null>(null)
  const [search, setSearch] = useState("")

  // Keep selectedCatalog in sync with live data
  const liveCatalog = selectedCatalog
    ? catalogs.find((c) => c.id === selectedCatalog.id) ?? null
    : null

  const filteredCatalogs = catalogs.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.source ?? "").toLowerCase().includes(search.toLowerCase())
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-indigo-500" />
          <p className="text-sm font-medium text-slate-500">Loading Purchase Catalogs…</p>
        </div>
      </div>
    )
  }

  // ── Detail view ──
  if (liveCatalog) {
    return (
      <div className="mx-auto w-full max-w-[1400px] space-y-8 pb-10">
        <CatalogDetailView
          catalog={liveCatalog}
          onBack={() => setSelectedCatalog(null)}
          onUpdateProducts={(products) => updateCatalogProducts(liveCatalog.id, products)}
        />
      </div>
    )
  }

  // ── Grid view ──
  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-8 pb-10">
      {/* Page header */}
      <div className="flex flex-col gap-6 border-b border-indigo-100 pb-8 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="flex items-center gap-2 text-indigo-600">
            <ShoppingBag className="h-7 w-7 shrink-0" />
            <span className="text-sm font-bold uppercase tracking-widest text-indigo-500">Purchase Catalog</span>
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 drop-shadow-sm">
            Order Catalogs
          </h1>
          <p className="text-sm text-slate-500 font-medium max-w-lg">
            Agency &amp; dealer catalog management. Import JSON or add manually — each group holds all products of that type.
          </p>
          <div className="flex items-center gap-2 pt-1">
            <SyncBadge status={syncStatus} />
            <Badge variant="outline" className="border-indigo-200 bg-indigo-50 text-indigo-700 px-3 py-1 font-semibold shadow-sm">
              {catalogs.length} catalog{catalogs.length !== 1 ? "s" : ""}
            </Badge>
          </div>
        </div>

        <Button
          onClick={() => { setEditingCatalog(null); setCatalogDialogOpen(true) }}
          className="shrink-0 shadow-lg gap-2 bg-gradient-to-r from-indigo-500 to-violet-600 text-white hover:from-indigo-600 hover:to-violet-700 transition-all duration-300 hover:-translate-y-0.5 border-none"
        >
          <Plus className="h-4 w-4" />
          New Catalog Group
        </Button>
      </div>

      {/* Search */}
      {catalogs.length > 0 && (
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search catalogs…"
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      )}

      {/* Empty state */}
      {catalogs.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-6 rounded-3xl border-2 border-dashed border-indigo-200 bg-indigo-50/30 py-24 text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-indigo-100 shadow-inner">
            <ShoppingBag className="h-9 w-9 text-indigo-500" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-bold text-slate-700">No Catalogs Yet</h2>
            <p className="text-sm text-slate-400 max-w-sm">
              Create your first catalog group — e.g. &ldquo;Pencil Sharpeners&rdquo; or &ldquo;Erasers&rdquo; — and add products manually or via JSON import.
            </p>
          </div>
          <Button
            onClick={() => setCatalogDialogOpen(true)}
            className="gap-2 bg-gradient-to-r from-indigo-500 to-violet-600 text-white border-none shadow-lg"
          >
            <Plus className="h-4 w-4" />
            Create First Catalog
          </Button>
        </div>
      )}

      {/* Catalog grid */}
      {filteredCatalogs.length > 0 && (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {filteredCatalogs.map((catalog) => (
            <CatalogCard
              key={catalog.id}
              catalog={catalog}
              onClick={() => setSelectedCatalog(catalog)}
              onEdit={() => {
                setEditingCatalog(catalog)
                setCatalogDialogOpen(true)
              }}
              onDelete={() => setDeletingCatalogId(catalog.id)}
            />
          ))}
        </div>
      )}

      {filteredCatalogs.length === 0 && catalogs.length > 0 && (
        <div className="py-12 text-center text-sm text-slate-400">
          No catalogs match &ldquo;{search}&rdquo;
        </div>
      )}

      {/* Dialogs */}
      <CatalogDialog
        open={catalogDialogOpen}
        onClose={() => { setCatalogDialogOpen(false); setEditingCatalog(null) }}
        onSave={async (name, source, color) => {
          if (editingCatalog) {
            await updateCatalogMeta(editingCatalog.id, name, source, color)
          } else {
            await createCatalog(name, source, color, [])
          }
        }}
        initial={editingCatalog}
      />

      {deletingCatalogId && (
        <ConfirmDeleteDialog
          open
          title="Delete Catalog Group"
          message={`Delete "${catalogs.find((c) => c.id === deletingCatalogId)?.name}"? All products inside will be permanently deleted.`}
          onConfirm={() => removeCatalog(deletingCatalogId)}
          onClose={() => setDeletingCatalogId(null)}
        />
      )}
    </div>
  )
}
