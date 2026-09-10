"use client"

import { useState, useRef, useEffect, useMemo } from "react"
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
  Download,
  Tags,
  Percent,
  Hash,
} from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { useGstPurchaseCatalog } from "@/hooks/use-gst-purchase-catalog"
import type { GstCatalogProduct, GstPurchaseCatalog } from "@/lib/features/gst-purchase-catalog/models"
import {
  catalogProductOrderTag,
  catalogProductGstPercent,
  catalogProductOrderId,
  catalogProductSalePrice,
  formatMarginPercent,
  gstLabel,
  marginPercentFromPrices,
  matchingSaleMarginPercent,
  NO_ORDER_ID,
  normalizeGstPercents,
  normalizeSaleMarginPercents,
  priceWithGst,
  salePriceFromMarginPercent,
} from "@/lib/features/gst-purchase-catalog/models"
import { downloadCatalogGroupPdf } from "@/lib/features/gst-purchase-catalog/pdf-export"
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
import { Checkbox } from "@/components/ui/checkbox"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { CatalogSyncStatus } from "@/hooks/use-gst-purchase-catalog"

function jsonPickString(rec: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const v = rec[key]
    if (typeof v === "string" && v.trim()) return v.trim()
    if (typeof v === "number" && Number.isFinite(v)) return String(v)
  }
  return ""
}

function jsonPickNumber(rec: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const v = rec[key]
    if (typeof v === "number" && Number.isFinite(v)) return v
    if (typeof v === "string" && v.trim()) {
      const n = Number(v.replace(/₹/g, "").replace(/Rs\.?/gi, "").replace(/,/g, "").trim())
      if (Number.isFinite(n)) return n
    }
  }
  return null
}

function SalePriceEditFields({
  buyPrice,
  salePrice,
  percents,
  onSalePriceChange,
  inputClassName,
}: {
  buyPrice: number
  salePrice: number | undefined
  percents: number[]
  onSalePriceChange: (salePrice: number | undefined) => void
  inputClassName?: string
}) {
  const computedPercent = salePrice == null ? null : marginPercentFromPrices(buyPrice, salePrice)
  const selectedPercent = matchingSaleMarginPercent(buyPrice, salePrice, percents)
  const liveLabel = formatMarginPercent(computedPercent)
  return (
    <div className="flex min-w-[12.5rem] items-center gap-1">
      <Input
        className={inputClassName}
        type="number"
        min={0}
        placeholder="—"
        value={salePrice ?? ""}
        onChange={(e) => {
          const raw = e.target.value
          if (raw === "") onSalePriceChange(undefined)
          else onSalePriceChange(Number(raw))
        }}
      />
      <Select
        value={selectedPercent === "" ? "live" : String(selectedPercent)}
        onValueChange={(value) => {
          if (value === "live") return
          const percent = Number(value)
          if (!Number.isFinite(buyPrice) || buyPrice <= 0) return
          onSalePriceChange(salePriceFromMarginPercent(buyPrice, percent))
        }}
      >
        <SelectTrigger className="h-8 w-[4.85rem] shrink-0 px-2 text-xs font-semibold">
          <span>{liveLabel}</span>
        </SelectTrigger>
        <SelectContent>
          {selectedPercent === "" ? (
            <SelectItem value="live" disabled>
              {liveLabel}
            </SelectItem>
          ) : null}
          {percents.map((percent) => (
            <SelectItem key={percent} value={String(percent)}>
              {formatMarginPercent(percent)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

function GstPercentSelect({
  value,
  percents,
  onChange,
  className,
  disabled,
}: {
  value: number | undefined
  percents: number[]
  onChange: (gst: number | undefined) => void
  className?: string
  disabled?: boolean
}) {
  const listed = value != null && percents.some((p) => Math.abs(p - value) < 0.051)
  const selectValue = value == null ? "none" : String(value)
  return (
    <Select
      disabled={disabled}
      value={selectValue}
      onValueChange={(next) => {
        if (next === "none") onChange(undefined)
        else onChange(Number(next))
      }}
    >
      <SelectTrigger className={cn("h-8 w-[7.25rem] shrink-0 px-2 text-xs font-semibold", className)}>
        <SelectValue placeholder="GST %" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="none">No GST</SelectItem>
        {value != null && !listed ? (
          <SelectItem value={String(value)}>{gstLabel(value)}</SelectItem>
        ) : null}
        {percents.map((percent) => (
          <SelectItem key={percent} value={String(percent)}>
            {gstLabel(percent)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

type BulkEditFields = {
  order_tag: boolean
  order_id: boolean
  brand: boolean
  unit: boolean
  notes: boolean
  price: boolean
  sale_price: boolean
  gst_percent: boolean
  moq: boolean
}

const EMPTY_BULK_FIELDS: BulkEditFields = {
  order_tag: true,
  order_id: false,
  brand: false,
  unit: false,
  notes: false,
  price: false,
  sale_price: false,
  gst_percent: false,
  moq: false,
}

// ─── Color palette for catalog cards ─────────────────────────────────────────
const CARD_COLORS = [
  { label: "Teal", value: "#0d9488" },
  { label: "Indigo", value: "#6366f1" },
  { label: "Violet", value: "#8b5cf6" },
  { label: "Sky", value: "#0ea5e9" },
  { label: "Aqua", value: "#14b8a6" },
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
  onDownloadPdf,
}: {
  catalog: GstPurchaseCatalog
  onClick: () => void
  onEdit: () => void
  onDelete: () => void
  onDownloadPdf: () => void
}) {
  const color = catalog.color ?? "#0d9488"
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
              className="rounded-lg p-1.5 text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
              onClick={onDownloadPdf}
              title="Download PDF"
            >
              <Download className="h-3.5 w-3.5" />
            </button>
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

        {/* Footer */}
        <div className="mt-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1 text-xs font-semibold" style={{ color }}>
            <span>View all products</span>
            <ChevronRight className="h-3.5 w-3.5" />
          </div>
          <button
            type="button"
            className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-500 hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
            onClick={(e) => {
              e.stopPropagation()
              onDownloadPdf()
            }}
          >
            <Download className="h-3 w-3" />
            PDF
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Product Detail Row ───────────────────────────────────────────────────────
function ProductRow({
  product,
  index,
  selected,
  editing,
  gstPercents,
  salePercents,
  onSelectChange,
  onChange,
  onEdit,
  onDelete,
}: {
  product: GstCatalogProduct
  index: number
  selected: boolean
  editing: boolean
  gstPercents: number[]
  salePercents: number[]
  onSelectChange: (checked: boolean) => void
  onChange: (patch: Partial<GstCatalogProduct>) => void
  onEdit: () => void
  onDelete: () => void
}) {
  const tag = catalogProductOrderTag(product)
  const orderId = catalogProductOrderId(product)
  const gst = catalogProductGstPercent(product)
  const salePrice = catalogProductSalePrice(product)
  const livePercent = salePrice == null ? null : marginPercentFromPrices(product.price, salePrice)
  const inclGst = priceWithGst(product.price, gst)
  const lineTotal = (Number(product.price) || 0) * (Number(product.moq) || 0)
  const cellInput = "h-8 min-w-[4.5rem] text-sm"
  return (
    <tr className={cn("group border-b border-slate-100 hover:bg-indigo-50/40 transition-colors", selected && "bg-indigo-50/70")}>
      <td className="py-3 pl-4 pr-2 w-10">
        <Checkbox
          checked={selected}
          disabled={editing}
          onCheckedChange={(checked) => onSelectChange(checked === true)}
          aria-label={`Select ${product.product_name}`}
        />
      </td>
      <td className="py-3 pr-2 text-sm font-medium text-slate-400 w-10">{index + 1}</td>
      <td className="py-3 px-3 text-sm font-semibold text-slate-800">
        {editing ? (
          <Input
            className={cn(cellInput, "min-w-[10rem]")}
            value={product.product_name}
            onChange={(e) => onChange({ product_name: e.target.value })}
          />
        ) : (
          product.product_name
        )}
      </td>
      <td className="py-3 px-3">
        {editing ? (
          <Input
            className={cn(cellInput, "font-mono")}
            value={product.order_tag ?? "NA"}
            onChange={(e) => onChange({ order_tag: e.target.value })}
          />
        ) : (
          <span className="inline-flex rounded-md bg-indigo-50 px-2 py-0.5 font-mono text-xs font-semibold text-indigo-700">
            {tag}
          </span>
        )}
      </td>
      <td className="py-3 px-3">
        {editing ? (
          <Input
            className={cn(cellInput, "font-mono")}
            value={product.order_id ?? ""}
            placeholder="Order ID"
            onChange={(e) => onChange({ order_id: e.target.value })}
          />
        ) : orderId ? (
          <span className="inline-flex rounded-md bg-teal-50 px-2 py-0.5 font-mono text-xs font-semibold text-teal-800">
            {orderId}
          </span>
        ) : (
          "—"
        )}
      </td>
      <td className="py-3 px-3 text-sm text-slate-600">
        {editing ? (
          <Input
            className={cellInput}
            value={product.brand ?? ""}
            onChange={(e) => onChange({ brand: e.target.value })}
          />
        ) : (
          product.brand ?? "—"
        )}
      </td>
      <td className="py-3 px-3 text-sm font-bold text-emerald-700">
        {editing ? (
          <Input
            className={cellInput}
            type="number"
            min={0}
            value={product.price}
            onChange={(e) => {
              const price = Number(e.target.value)
              if (livePercent != null && Number.isFinite(price) && price > 0) {
                onChange({
                  price,
                  sale_price: salePriceFromMarginPercent(price, livePercent),
                })
              } else {
                onChange({ price })
              }
            }}
          />
        ) : (
          `₹${product.price.toLocaleString("en-IN")}`
        )}
      </td>
      <td className="py-3 px-3 text-sm font-bold text-sky-700">
        {editing ? (
          <SalePriceEditFields
            buyPrice={product.price}
            salePrice={salePrice}
            percents={salePercents}
            inputClassName={cellInput}
            onSalePriceChange={(next) => onChange({ sale_price: next })}
          />
        ) : salePrice != null ? (
          `₹${salePrice.toLocaleString("en-IN")}`
        ) : (
          "—"
        )}
      </td>
      <td className="py-3 px-3">
        <span className="inline-flex rounded-md bg-sky-50 px-2 py-0.5 text-xs font-semibold text-sky-800">
          {formatMarginPercent(livePercent)}
        </span>
      </td>
      <td className="py-3 px-3 text-sm font-bold text-teal-700">
        {editing ? (
          <GstPercentSelect
            value={gst}
            percents={gstPercents}
            onChange={(next) => onChange({ gst_percent: next })}
          />
        ) : (
          gstLabel(gst)
        )}
      </td>
      <td className="py-3 px-3">
        <span className="inline-flex rounded-md bg-teal-50 px-2 py-0.5 text-xs font-semibold text-teal-800">
          ₹{inclGst.toLocaleString("en-IN")}
        </span>
      </td>
      <td className="py-3 px-3 text-sm text-slate-600">
        {editing ? (
          <Input
            className={cellInput}
            type="number"
            min={1}
            value={product.moq}
            onChange={(e) => onChange({ moq: Number(e.target.value) })}
          />
        ) : (
          `×${product.moq}`
        )}
      </td>
      <td className="py-3 px-3 text-sm font-bold tabular-nums text-slate-800">
        ₹{lineTotal.toLocaleString("en-IN")}
      </td>
      <td className="py-3 px-3 text-sm text-slate-500">
        {editing ? (
          <Input
            className={cellInput}
            value={product.unit ?? ""}
            onChange={(e) => onChange({ unit: e.target.value })}
          />
        ) : (
          product.unit ?? "—"
        )}
      </td>
      <td className="py-3 pl-3 pr-4 text-right">
        {!editing ? (
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
        ) : null}
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
  initial?: GstPurchaseCatalog | null
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
  gstPercents,
  salePercents,
}: {
  open: boolean
  onClose: () => void
  onSave: (product: GstCatalogProduct) => Promise<void>
  initial?: GstCatalogProduct | null
  gstPercents: number[]
  salePercents: number[]
}) {
  const [productName, setProductName] = useState(initial?.product_name ?? "")
  const [orderTag, setOrderTag] = useState(initial?.order_tag ?? "NA")
  const [orderId, setOrderId] = useState(initial?.order_id ?? "")
  const [price, setPrice] = useState(initial?.price?.toString() ?? "")
  const [salePrice, setSalePrice] = useState(initial?.sale_price?.toString() ?? "")
  const [gstPercent, setGstPercent] = useState<number | undefined>(catalogProductGstPercent(initial ?? {} as GstCatalogProduct))
  const [moq, setMoq] = useState(initial?.moq?.toString() ?? "")
  const [brand, setBrand] = useState(initial?.brand ?? "")
  const [unit, setUnit] = useState(initial?.unit ?? "")
  const [notes, setNotes] = useState(initial?.notes ?? "")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!open) return
    setProductName(initial?.product_name ?? "")
    setOrderTag(initial ? catalogProductOrderTag(initial) : "NA")
    setOrderId(initial ? catalogProductOrderId(initial) : "")
    setPrice(initial?.price?.toString() ?? "")
    setSalePrice(initial?.sale_price != null ? String(initial.sale_price) : "")
    setGstPercent(catalogProductGstPercent(initial ?? ({} as GstCatalogProduct)))
    setMoq(initial?.moq?.toString() ?? "")
    setBrand(initial?.brand ?? "")
    setUnit(initial?.unit ?? "")
    setNotes(initial?.notes ?? "")
    setError("")
  }, [open, initial])

  const handleOpenChange = (o: boolean) => {
    if (!o) {
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
        order_tag: orderTag.trim() || "NA",
        ...(orderId.trim() ? { order_id: orderId.trim() } : {}),
        ...(salePrice !== "" && !Number.isNaN(Number(salePrice))
          ? { sale_price: Number(salePrice) }
          : {}),
        ...(gstPercent != null ? { gst_percent: gstPercent } : {}),
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
          <div className="space-y-1.5">
            <Label htmlFor="prod-order-tag">Order Tag / No</Label>
            <Input
              id="prod-order-tag"
              placeholder="e.g. 123456 or TATA"
              value={orderTag}
              onChange={(e) => setOrderTag(e.target.value)}
            />
            <p className="text-[11px] text-slate-400">Use the same tag for all products from one order so you can filter them later.</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="prod-order-id">Order ID</Label>
            <Input
              id="prod-order-id"
              placeholder="e.g. PO-1045"
              value={orderId}
              onChange={(e) => setOrderId(e.target.value)}
            />
            <p className="text-[11px] text-slate-400">Used to group and filter products. Select one or more Order IDs above the list, or ALL.</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="prod-price">Price (₹) *</Label>
              <Input
                id="prod-price"
                type="number"
                min={0}
                placeholder="18"
                value={price}
                onChange={(e) => {
                  const next = e.target.value
                  setPrice(next)
                  const buy = Number(next)
                  const sale = salePrice === "" ? undefined : Number(salePrice)
                  const livePct =
                    sale == null ? null : marginPercentFromPrices(Number(price) || 0, sale)
                  if (livePct != null && Number.isFinite(buy) && buy > 0) {
                    setSalePrice(String(salePriceFromMarginPercent(buy, livePct)))
                  }
                }}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="prod-sale-price">Sale Price (₹)</Label>
              <SalePriceEditFields
                buyPrice={Number(price) || 0}
                salePrice={salePrice === "" ? undefined : Number(salePrice)}
                percents={salePercents}
                onSalePriceChange={(next) => setSalePrice(next == null || Number.isNaN(next) ? "" : String(next))}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>GST %</Label>
              <GstPercentSelect value={gstPercent} percents={gstPercents} onChange={setGstPercent} className="h-9 w-full" />
              {gstPercent != null && Number(price) > 0 ? (
                <p className="text-[11px] text-teal-700 font-medium">
                  Price + GST: ₹{priceWithGst(Number(price), gstPercent).toLocaleString("en-IN")}
                </p>
              ) : null}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="prod-moq">MOQ *</Label>
              <Input id="prod-moq" type="number" min={1} placeholder="24" value={moq} onChange={(e) => setMoq(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="prod-unit">Unit</Label>
              <Input id="prod-unit" placeholder="e.g. pcs, box" value={unit} onChange={(e) => setUnit(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="prod-brand">Brand</Label>
              <Input id="prod-brand" placeholder="e.g. Apsara" value={brand} onChange={(e) => setBrand(e.target.value)} />
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
  percents,
}: {
  open: boolean
  onClose: () => void
  onImport: (products: GstCatalogProduct[]) => void
  percents: number[]
}) {
  const [json, setJson] = useState("")
  const [error, setError] = useState("")
  const [preview, setPreview] = useState<GstCatalogProduct[] | null>(null)
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
      const cleaned = raw.replace(/,\s*([\]}])/g, "$1")
      const parsed = JSON.parse(cleaned) as unknown

      let wrapperTag = ""
      let wrapperBrand = ""
      let wrapperUnit = ""
      let arr: unknown[] = []
      if (Array.isArray(parsed)) {
        arr = parsed
      } else if (parsed && typeof parsed === "object") {
        const root = parsed as Record<string, unknown>
        wrapperTag = jsonPickString(root, ["order_tag", "orderTag", "order_no", "orderNo"])
        wrapperBrand = jsonPickString(root, ["brand", "manufacturer"])
        wrapperUnit = jsonPickString(root, ["unit", "units"])
        const nested = root.items ?? root.products
        arr = Array.isArray(nested) ? nested : [parsed]
      }

      const mapped: GstCatalogProduct[] = []
      for (const item of arr) {
        if (!item || typeof item !== "object") continue
        const rec = item as Record<string, unknown>
        const productName = jsonPickString(rec, ["product_name", "productName", "name", "product", "item"])
        const price = jsonPickNumber(rec, ["price", "buy_rate", "buyRate", "rate"])
        const moq = jsonPickNumber(rec, ["moq", "MOQ", "qty", "quantity", "min_qty"])
        if (!productName || price === null || moq === null) {
          setError("Each item must have: product_name, price, and moq (brand/unit/order_tag optional)")
          return
        }
        const tag = jsonPickString(rec, ["order_tag", "orderTag", "order_no", "orderNo"]) || wrapperTag
        const orderId = jsonPickString(rec, ["order_id", "orderId", "orderID", "po", "PO"])
        const brand = jsonPickString(rec, ["brand", "manufacturer", "Brand"]) || wrapperBrand
        const unit = jsonPickString(rec, ["unit", "units", "Unit"]) || wrapperUnit
        const notes = jsonPickString(rec, ["notes", "note", "remark", "remarks"])
        const gstRaw = jsonPickNumber(rec, ["gst_percent", "gstPercent", "gst", "GST"])
        let gst: number | null = gstRaw
        if (gst !== null) {
          const match = percents.find((p) => Math.abs(p - gst!) < 0.051)
          if (match != null) gst = match
        }
        const salePrice = jsonPickNumber(rec, ["sale_price", "salePrice", "selling_price", "sellingPrice"])
        mapped.push({
          product_name: productName,
          price,
          moq,
          order_tag: tag || "NA",
          ...(orderId ? { order_id: orderId } : {}),
          ...(brand ? { brand } : {}),
          ...(unit ? { unit } : {}),
          ...(notes ? { notes } : {}),
          ...(salePrice !== null ? { sale_price: salePrice } : {}),
          ...(gst !== null ? { gst_percent: gst } : {}),
        })
      }

      if (mapped.length === 0) {
        setError("No valid products found in JSON")
        return
      }
      setPreview(mapped)
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
            {`[ { "product_name": "Cup Shape Pencil Sharpener", "brand": "Apsara", "price": 18, "sale_price": 22, "gst_percent": 18, "moq": 24, "unit": "pcs", "order_tag": "TATA", "order_id": "PO-1045" }, ... ]`}
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
                    {i + 1}. {p.product_name}
                    {p.brand ? ` · ${p.brand}` : ""}
                    {` — ₹${p.price} × MOQ ${p.moq}`}
                    {p.sale_price != null ? ` · sale ₹${p.sale_price}` : ""}
                    {p.order_id ? ` · ID ${p.order_id}` : ""}
                    {p.gst_percent != null ? ` · GST ${gstLabel(p.gst_percent)}` : ""}
                    {p.unit ? ` · ${p.unit}` : ""}
                    {` · ${p.order_tag || "NA"}`}
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
  gstPercents,
  salePercents,
}: {
  catalog: GstPurchaseCatalog
  onBack: () => void
  onUpdateProducts: (products: GstCatalogProduct[]) => Promise<void>
  gstPercents: number[]
  salePercents: number[]
}) {
  const [products, setProducts] = useState<GstCatalogProduct[]>(catalog.products)
  const [productDialogOpen, setProductDialogOpen] = useState(false)
  const [jsonImportOpen, setJsonImportOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<{ product: GstCatalogProduct; index: number } | null>(null)
  const [deletingIndex, setDeletingIndex] = useState<number | null>(null)
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [orderTagFilter, setOrderTagFilter] = useState("all")
  const [orderIdFilter, setOrderIdFilter] = useState<Set<string>>(new Set())
  const [discountPercent, setDiscountPercent] = useState("")
  const [gstFilter, setGstFilter] = useState("all")
  const [selectedIndexes, setSelectedIndexes] = useState<Set<number>>(new Set())
  const [bulkEditDialogOpen, setBulkEditDialogOpen] = useState(false)
  const [bulkFields, setBulkFields] = useState<BulkEditFields>(EMPTY_BULK_FIELDS)
  const [bulkValues, setBulkValues] = useState({
    order_tag: "NA",
    order_id: "",
    brand: "",
    unit: "",
    notes: "",
    price: "",
    sale_price: "",
    gst_percent: "",
    moq: "",
  })
  const [saving, setSaving] = useState(false)
  const [downloadingPdf, setDownloadingPdf] = useState(false)
  const [tableEditing, setTableEditing] = useState(false)

  const color = catalog.color ?? "#0d9488"

  useEffect(() => {
    if (!tableEditing) setProducts(catalog.products)
  }, [catalog.products, tableEditing])

  const handleDownloadPdf = async () => {
    setDownloadingPdf(true)
    try {
      const visible = products.filter((product) => {
        const tag = catalogProductOrderTag(product)
        const orderId = catalogProductOrderId(product) || NO_ORDER_ID
        const gst = catalogProductGstPercent(product)
        if (orderTagFilter !== "all" && tag !== orderTagFilter) return false
        if (orderIdFilter.size > 0 && !orderIdFilter.has(orderId)) return false
        if (gstFilter === "all") return true
        if (gstFilter === "none") return gst == null
        return gst != null && String(gst) === gstFilter
      })
      const pct = Number(discountPercent)
      const discount = Number.isFinite(pct) && pct > 0 ? Math.min(pct, 100) : 0
      await downloadCatalogGroupPdf(
        { ...catalog, products: visible },
        { discountPercent: discount }
      )
    } finally {
      setDownloadingPdf(false)
    }
  }

  // Keep local products in sync if catalog prop changes
  const syncProducts = async (updated: GstCatalogProduct[]) => {
    const previous = products
    setProducts(updated)
    setSaving(true)
    try {
      await onUpdateProducts(updated)
    } catch (e) {
      console.error(e)
      setProducts(previous)
      toast.error(e instanceof Error ? e.message : "Failed to save products")
    } finally {
      setSaving(false)
    }
  }

  const handleAddProduct = async (product: GstCatalogProduct) => {
    await syncProducts([...products, product])
  }

  const handleEditProduct = async (product: GstCatalogProduct) => {
    if (editingProduct === null) return
    const updated = products.map((p, i) => (i === editingProduct.index ? product : p))
    await syncProducts(updated)
    setEditingProduct(null)
  }

  const handleDeleteProduct = async (index: number) => {
    const updated = products.filter((_, i) => i !== index)
    await syncProducts(updated)
    setSelectedIndexes((prev) => {
      const next = new Set<number>()
      prev.forEach((i) => {
        if (i < index) next.add(i)
        else if (i > index) next.add(i - 1)
      })
      return next
    })
    setDeletingIndex(null)
  }

  const handleBulkDelete = async () => {
    if (selectedIndexes.size === 0) return
    const updated = products.filter((_, i) => !selectedIndexes.has(i))
    await syncProducts(updated)
    setSelectedIndexes(new Set())
    setBulkDeleteOpen(false)
  }

  const handleJsonImport = async (imported: GstCatalogProduct[]) => {
    // Merge: avoid exact duplicates by product_name
    const existing = new Set(products.map((p) => p.product_name.toLowerCase()))
    const newOnes = imported.filter((p) => !existing.has(p.product_name.toLowerCase()))
    const merged = [...products, ...newOnes]
    await syncProducts(merged)
  }

  const availableOrderTags = useMemo(() => {
    const tags = new Set<string>()
    products.forEach((p) => tags.add(catalogProductOrderTag(p)))
    return [...tags].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }))
  }, [products])

  const availableOrderIds = useMemo(() => {
    const ids = new Set<string>()
    products.forEach((p) => {
      const id = catalogProductOrderId(p)
      ids.add(id || NO_ORDER_ID)
    })
    return [...ids].sort((a, b) => {
      if (a === NO_ORDER_ID) return 1
      if (b === NO_ORDER_ID) return -1
      return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" })
    })
  }, [products])

  const orderIdAllSelected = orderIdFilter.size === 0

  const toggleOrderIdFilter = (value: string) => {
    if (value === "all") {
      setOrderIdFilter(new Set())
      return
    }
    setOrderIdFilter((prev) => {
      const next = new Set(prev)
      if (orderIdAllSelected) {
        return new Set([value])
      }
      if (next.has(value)) next.delete(value)
      else next.add(value)
      return next
    })
  }

  const availableGstPercents = useMemo(() => {
    const values = new Set<string>(["none"])
    gstPercents.forEach((p) => values.add(String(p)))
    products.forEach((p) => {
      const gst = catalogProductGstPercent(p)
      values.add(gst == null ? "none" : String(gst))
    })
    return [...values].sort((a, b) => {
      if (a === "none") return -1
      if (b === "none") return 1
      return Number(a) - Number(b)
    })
  }, [products, gstPercents])

  const filtered = products
    .map((product, index) => ({ product, index }))
    .filter(({ product }) => {
      const q = search.toLowerCase()
      const tag = catalogProductOrderTag(product)
      const orderId = catalogProductOrderId(product) || NO_ORDER_ID
      const gst = catalogProductGstPercent(product)
      const matchesSearch =
        product.product_name.toLowerCase().includes(q) ||
        (product.brand ?? "").toLowerCase().includes(q) ||
        tag.toLowerCase().includes(q) ||
        orderId.toLowerCase().includes(q) ||
        gstLabel(gst).toLowerCase().includes(q)
      if (!matchesSearch) return false
      if (orderTagFilter !== "all" && tag !== orderTagFilter) return false
      if (!orderIdAllSelected && !orderIdFilter.has(orderId)) return false
      if (gstFilter === "all") return true
      if (gstFilter === "none") return gst == null
      return gst != null && String(gst) === gstFilter
    })

  const allFilteredSelected =
    filtered.length > 0 && filtered.every(({ index }) => selectedIndexes.has(index))
  const someFilteredSelected =
    filtered.some(({ index }) => selectedIndexes.has(index)) && !allFilteredSelected

  const toggleSelect = (index: number, checked: boolean) => {
    setSelectedIndexes((prev) => {
      const next = new Set(prev)
      if (checked) next.add(index)
      else next.delete(index)
      return next
    })
  }

  const toggleSelectAllFiltered = (checked: boolean) => {
    setSelectedIndexes((prev) => {
      const next = new Set(prev)
      filtered.forEach(({ index }) => {
        if (checked) next.add(index)
        else next.delete(index)
      })
      return next
    })
  }

  const handleBulkEdit = async () => {
    if (!Object.values(bulkFields).some(Boolean)) return
    if (bulkFields.price && (bulkValues.price === "" || Number.isNaN(Number(bulkValues.price)))) return
    if (bulkFields.sale_price && bulkValues.sale_price !== "" && Number.isNaN(Number(bulkValues.sale_price))) return
    if (bulkFields.gst_percent && bulkValues.gst_percent !== "" && Number.isNaN(Number(bulkValues.gst_percent))) return
    if (bulkFields.moq && (bulkValues.moq === "" || Number.isNaN(Number(bulkValues.moq)))) return

    const updated = products.map((p, i) => {
      if (!selectedIndexes.has(i)) return p
      const next: GstCatalogProduct = { ...p }
      if (bulkFields.order_tag) next.order_tag = bulkValues.order_tag.trim() || "NA"
      if (bulkFields.order_id) {
        if (bulkValues.order_id.trim() === "") delete next.order_id
        else next.order_id = bulkValues.order_id.trim()
      }
      if (bulkFields.brand) next.brand = bulkValues.brand.trim() || undefined
      if (bulkFields.unit) next.unit = bulkValues.unit.trim() || undefined
      if (bulkFields.notes) next.notes = bulkValues.notes.trim() || undefined
      if (bulkFields.price) next.price = Number(bulkValues.price)
      if (bulkFields.sale_price) {
        if (bulkValues.sale_price.trim() === "") delete next.sale_price
        else next.sale_price = Number(bulkValues.sale_price)
      }
      if (bulkFields.gst_percent) {
        if (bulkValues.gst_percent.trim() === "") delete next.gst_percent
        else next.gst_percent = Number(bulkValues.gst_percent)
      }
      if (bulkFields.moq) next.moq = Number(bulkValues.moq)
      return next
    })
    await syncProducts(updated)
    setSelectedIndexes(new Set())
    setBulkEditDialogOpen(false)
  }

  const openBulkEdit = () => {
    setBulkFields({ ...EMPTY_BULK_FIELDS })
    setBulkValues({
      order_tag: "NA",
      order_id: "",
      brand: "",
      unit: "",
      notes: "",
      price: "",
      sale_price: "",
      gst_percent: "",
      moq: "",
    })
    setBulkEditDialogOpen(true)
  }

  const startTableEdit = () => {
    setTableEditing(true)
    setSelectedIndexes(new Set())
  }

  const cancelTableEdit = () => {
    setProducts(catalog.products)
    setTableEditing(false)
  }

  const saveTableEdit = async () => {
    const cleaned = products.map((p) => {
      const next: GstCatalogProduct = {
        product_name: p.product_name.trim() || p.product_name,
        price: Number.isFinite(Number(p.price)) ? Number(p.price) : 0,
        moq: Number.isFinite(Number(p.moq)) && Number(p.moq) > 0 ? Number(p.moq) : 1,
        order_tag: catalogProductOrderTag(p),
      }
      const oid = catalogProductOrderId(p)
      if (oid) next.order_id = oid
      if (p.brand?.trim()) next.brand = p.brand.trim()
      if (p.unit?.trim()) next.unit = p.unit.trim()
      if (p.notes?.trim()) next.notes = p.notes.trim()
      const sale = catalogProductSalePrice(p)
      if (sale != null) next.sale_price = sale
      const gst = catalogProductGstPercent(p)
      if (gst != null) next.gst_percent = gst
      return next
    })
    await syncProducts(cleaned)
    setTableEditing(false)
  }

  const patchProductAt = (index: number, patch: Partial<GstCatalogProduct>) => {
    setProducts((prev) =>
      prev.map((p, i) => {
        if (i !== index) return p
        const next: GstCatalogProduct = { ...p, ...patch }
        if ("gst_percent" in patch && (patch.gst_percent === undefined || Number.isNaN(Number(patch.gst_percent)))) {
          delete next.gst_percent
        }
        if ("sale_price" in patch && (patch.sale_price === undefined || Number.isNaN(Number(patch.sale_price)))) {
          delete next.sale_price
        }
        if ("order_id" in patch && !String(patch.order_id ?? "").trim()) delete next.order_id
        if ("brand" in patch && !String(patch.brand ?? "").trim()) delete next.brand
        if ("unit" in patch && !String(patch.unit ?? "").trim()) delete next.unit
        return next
      })
    )
  }

  const filteredMoqTotal = filtered.reduce((sum, { product }) => sum + product.price * product.moq, 0)
  const discountPct = Number(discountPercent)
  const validDiscount = Number.isFinite(discountPct) && discountPct > 0 ? Math.min(discountPct, 100) : 0
  const discountAmount = Math.round(filteredMoqTotal * (validDiscount / 100) * 100) / 100
  const discountedBalance = Math.round((filteredMoqTotal - discountAmount) * 100) / 100

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
            disabled={products.length === 0 || downloadingPdf}
            onClick={handleDownloadPdf}
            className="gap-2 border-emerald-200 text-emerald-700 hover:bg-emerald-50"
          >
            {downloadingPdf ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Download className="h-3.5 w-3.5" />
            )}
            Download PDF
          </Button>
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

      {/* Order ID chips */}
      {availableOrderIds.length > 0 && (
        <div className="rounded-xl border border-teal-100 bg-teal-50/40 px-4 py-3 space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-teal-800">
            <Hash className="h-3.5 w-3.5" />
            Order ID
            <span className="font-medium normal-case tracking-normal text-teal-600">
              — tap ALL, or one / several IDs
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => toggleOrderIdFilter("all")}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-semibold transition-colors",
                orderIdAllSelected
                  ? "border-teal-600 bg-teal-600 text-white"
                  : "border-teal-200 bg-white text-teal-800 hover:bg-teal-50"
              )}
            >
              ALL
            </button>
            {availableOrderIds.map((id) => {
              const selected = !orderIdAllSelected && orderIdFilter.has(id)
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => toggleOrderIdFilter(id)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-semibold font-mono transition-colors",
                    selected
                      ? "border-teal-600 bg-teal-600 text-white"
                      : "border-teal-200 bg-white text-teal-800 hover:bg-teal-50"
                  )}
                >
                  {id === NO_ORDER_ID ? "No ID" : id}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* KPI bar */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {[
          { label: "Total Products", value: String(orderIdAllSelected ? products.length : filtered.length), icon: Package, color: "#0d9488" },
          { label: "Min Price", value: products.length > 0 ? `₹${Math.min(...products.map((p) => p.price))}` : "—", icon: IndianRupee, color: "#10b981" },
          { label: "Max Price", value: products.length > 0 ? `₹${Math.max(...products.map((p) => p.price))}` : "—", icon: IndianRupee, color: "#f97316" },
          { label: "MOQ × Price Total", value: `₹${filteredMoqTotal.toLocaleString("en-IN")}`, icon: Layers, color: color },
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
        <div className="rounded-xl border border-amber-100 bg-amber-50/50 p-4 shadow-sm col-span-2 lg:col-span-1">
          <div className="flex items-center gap-2 mb-2">
            <Percent className="h-3.5 w-3.5 text-amber-600" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700">Discount</span>
          </div>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={0}
              max={100}
              placeholder="0"
              className="h-8 bg-white"
              value={discountPercent}
              onChange={(e) => setDiscountPercent(e.target.value)}
            />
            <span className="text-sm font-semibold text-slate-500 shrink-0">%</span>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Off: ₹{discountAmount.toLocaleString("en-IN")}
          </p>
          <p className="text-lg font-black text-amber-900">
            Balance ₹{discountedBalance.toLocaleString("en-IN")}
          </p>
        </div>
      </div>

      {/* Search + order tag filter */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search products, brand, order tag, order ID, or GST…"
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={orderTagFilter} onValueChange={setOrderTagFilter}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="All order tags" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All order tags</SelectItem>
            {availableOrderTags.map((tag) => (
              <SelectItem key={tag} value={tag}>
                {tag}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={gstFilter} onValueChange={setGstFilter}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="All GST" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All GST %</SelectItem>
            {availableGstPercents.map((value) => (
              <SelectItem key={value} value={value}>
                {value === "none" ? "No GST" : gstLabel(Number(value))}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {tableEditing ? (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={cancelTableEdit} disabled={saving}>
              Cancel
            </Button>
            <Button size="sm" className="gap-2" onClick={() => void saveTableEdit()} disabled={saving}>
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              Save Items
            </Button>
          </div>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            disabled={products.length === 0}
            onClick={startTableEdit}
          >
            <Pencil className="h-3.5 w-3.5" />
            Edit Items
          </Button>
        )}
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
            {tableEditing && (
              <div className="border-b border-amber-100 bg-amber-50/80 px-4 py-2 text-sm font-medium text-amber-900">
                Editing table — change any item including sale price, then click Save Items.
              </div>
            )}
            {selectedIndexes.size > 0 && !tableEditing && (
              <div className="flex flex-wrap items-center gap-3 border-b border-indigo-100 bg-indigo-50/80 px-4 py-3">
                <span className="text-sm font-semibold text-indigo-900">
                  {selectedIndexes.size} item{selectedIndexes.size === 1 ? "" : "s"} selected
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 border-indigo-200 bg-white"
                  onClick={openBulkEdit}
                >
                  <Tags className="h-3.5 w-3.5" />
                  Bulk edit
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 border-red-200 bg-white text-red-700 hover:bg-red-50 hover:text-red-800"
                  onClick={() => setBulkDeleteOpen(true)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete selected
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setSelectedIndexes(new Set())}
                >
                  Clear
                </Button>
              </div>
            )}
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="py-3 pl-4 pr-2 w-10">
                    <Checkbox
                      checked={allFilteredSelected ? true : someFilteredSelected ? "indeterminate" : false}
                      onCheckedChange={(checked) => toggleSelectAllFiltered(checked === true)}
                      aria-label="Select all visible products"
                      disabled={filtered.length === 0 || tableEditing}
                    />
                  </th>
                  <th className="py-3 pr-2 text-xs font-bold uppercase tracking-wider text-slate-400 w-10">#</th>
                  <th className="py-3 px-3 text-xs font-bold uppercase tracking-wider text-slate-500">Product Name</th>
                  <th className="py-3 px-3 text-xs font-bold uppercase tracking-wider text-slate-500">Order Tag / No</th>
                  <th className="py-3 px-3 text-xs font-bold uppercase tracking-wider text-slate-500">Order ID</th>
                  <th className="py-3 px-3 text-xs font-bold uppercase tracking-wider text-slate-500">Brand</th>
                  <th className="py-3 px-3 text-xs font-bold uppercase tracking-wider text-slate-500">Price</th>
                  <th className="py-3 px-3 text-xs font-bold uppercase tracking-wider text-slate-500">Sale Price</th>
                  <th className="py-3 px-3 text-xs font-bold uppercase tracking-wider text-slate-500">%</th>
                  <th className="py-3 px-3 text-xs font-bold uppercase tracking-wider text-slate-500">GST %</th>
                  <th className="py-3 px-3 text-xs font-bold uppercase tracking-wider text-slate-500">Price + GST</th>
                  <th className="py-3 px-3 text-xs font-bold uppercase tracking-wider text-slate-500">MOQ</th>
                  <th className="py-3 px-3 text-xs font-bold uppercase tracking-wider text-slate-500">Total</th>
                  <th className="py-3 px-3 text-xs font-bold uppercase tracking-wider text-slate-500">Unit</th>
                  <th className="py-3 pl-3 pr-4 text-xs font-bold uppercase tracking-wider text-slate-400 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(({ product, index }, i) => (
                    <ProductRow
                      key={`${product.product_name}-${index}`}
                      product={product}
                      index={i}
                      selected={selectedIndexes.has(index)}
                      editing={tableEditing}
                      gstPercents={gstPercents}
                      salePercents={salePercents}
                      onSelectChange={(checked) => toggleSelect(index, checked)}
                      onChange={(patch) => patchProductAt(index, patch)}
                      onEdit={() => {
                        setEditingProduct({ product, index })
                        setProductDialogOpen(true)
                      }}
                      onDelete={() => setDeletingIndex(index)}
                    />
                ))}
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
        gstPercents={gstPercents}
        salePercents={salePercents}
      />

      <JsonImportDialog
        open={jsonImportOpen}
        onClose={() => setJsonImportOpen(false)}
        onImport={handleJsonImport}
        percents={gstPercents}
      />

      <Dialog open={bulkEditDialogOpen} onOpenChange={setBulkEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Bulk edit {selectedIndexes.size} items</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-slate-500">
            Tick the fields you want to change. Unticked fields stay as they are.
          </p>
          <div className="space-y-3 py-1">
            {(
              [
                { key: "order_tag", label: "Order Tag / No", placeholder: "e.g. 123456 or TATA" },
                { key: "order_id", label: "Order ID", placeholder: "e.g. PO-1045" },
                { key: "brand", label: "Brand", placeholder: "e.g. Apsara" },
                { key: "unit", label: "Unit", placeholder: "e.g. pcs, box" },
                { key: "notes", label: "Notes", placeholder: "Any extra info" },
                { key: "price", label: "Price (₹)", placeholder: "18" },
                { key: "sale_price", label: "Sale Price (₹)", placeholder: "22" },
                { key: "gst_percent", label: "GST %", placeholder: "18" },
                { key: "moq", label: "MOQ", placeholder: "24" },
              ] as const
            ).map((field) => (
              <div key={field.key} className="flex items-start gap-3">
                <Checkbox
                  id={`bulk-${field.key}`}
                  className="mt-2.5"
                  checked={bulkFields[field.key]}
                  onCheckedChange={(checked) =>
                    setBulkFields((prev) => ({ ...prev, [field.key]: checked === true }))
                  }
                />
                <div className="min-w-0 flex-1 space-y-1">
                  <Label htmlFor={`bulk-${field.key}-value`}>{field.label}</Label>
                  {field.key === "gst_percent" ? (
                    <GstPercentSelect
                      value={bulkValues.gst_percent === "" ? undefined : Number(bulkValues.gst_percent)}
                      percents={gstPercents}
                      disabled={!bulkFields.gst_percent}
                      onChange={(next) =>
                        setBulkValues((prev) => ({
                          ...prev,
                          gst_percent: next == null ? "" : String(next),
                        }))
                      }
                      className="h-9 w-full max-w-[12rem]"
                    />
                  ) : (
                    <Input
                      id={`bulk-${field.key}-value`}
                      type={field.key === "price" || field.key === "sale_price" || field.key === "moq" ? "number" : "text"}
                      min={field.key === "moq" ? 1 : field.key === "price" || field.key === "sale_price" ? 0 : undefined}
                      placeholder={field.placeholder}
                      value={bulkValues[field.key]}
                      disabled={!bulkFields[field.key]}
                      onChange={(e) =>
                        setBulkValues((prev) => ({ ...prev, [field.key]: e.target.value }))
                      }
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => void handleBulkEdit()}
              disabled={saving || !Object.values(bulkFields).some(Boolean)}
            >
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Apply to selected
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {deletingIndex !== null && (
        <ConfirmDeleteDialog
          open
          title="Delete Product"
          message={`Delete "${products[deletingIndex]?.product_name}"? This cannot be undone.`}
          onConfirm={() => handleDeleteProduct(deletingIndex)}
          onClose={() => setDeletingIndex(null)}
        />
      )}

      {bulkDeleteOpen && (
        <ConfirmDeleteDialog
          open
          title="Delete selected products"
          message={`Delete ${selectedIndexes.size} selected item${selectedIndexes.size === 1 ? "" : "s"}? This cannot be undone.`}
          onConfirm={handleBulkDelete}
          onClose={() => setBulkDeleteOpen(false)}
        />
      )}
    </div>
  )
}

function SaleMarginPercentsCard({
  percents,
  onSave,
}: {
  percents: number[]
  onSave: (next: number[]) => Promise<void>
}) {
  const [draft, setDraft] = useState("")
  const [saving, setSaving] = useState(false)

  const addPercent = async () => {
    const n = Number(draft)
    if (!Number.isFinite(n) || n <= 0 || n > 500) return
    const next = normalizeSaleMarginPercents([...percents, n])
    setSaving(true)
    try {
      await onSave(next)
      setDraft("")
    } finally {
      setSaving(false)
    }
  }

  const removePercent = async (percent: number) => {
    const next = percents.filter((p) => p !== percent)
    setSaving(true)
    try {
      await onSave(next)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="border-indigo-100 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Percent className="h-4 w-4 text-indigo-600" />
          Sale price % options
        </CardTitle>
        <CardDescription>
          These percentages appear in the sale price dropdown. Sale price = buy price + this %.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {percents.map((percent) => (
            <span
              key={percent}
              className="inline-flex items-center gap-1 rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-800"
            >
              {formatMarginPercent(percent)}
              <button
                type="button"
                className="rounded-full p-0.5 text-indigo-400 hover:bg-white hover:text-red-500"
                onClick={() => void removePercent(percent)}
                disabled={saving}
                title={`Remove ${formatMarginPercent(percent)}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
        <div className="flex max-w-xs items-center gap-2">
          <Input
            type="number"
            min={1}
            max={500}
            placeholder="e.g. 12"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                void addPercent()
              }
            }}
          />
          <Button type="button" size="sm" className="gap-1.5 shrink-0" disabled={saving || !draft} onClick={() => void addPercent()}>
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            Add %
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function GstPercentsCard({
  percents,
  onSave,
}: {
  percents: number[]
  onSave: (next: number[]) => Promise<void>
}) {
  const [draft, setDraft] = useState("")
  const [saving, setSaving] = useState(false)

  const addPercent = async () => {
    const n = Number(draft)
    if (!Number.isFinite(n) || n < 0 || n > 100) return
    const next = normalizeGstPercents([...percents, n])
    setSaving(true)
    try {
      await onSave(next)
      setDraft("")
    } finally {
      setSaving(false)
    }
  }

  const removePercent = async (percent: number) => {
    const next = percents.filter((p) => p !== percent)
    setSaving(true)
    try {
      await onSave(next)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="border-teal-100 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Percent className="h-4 w-4 text-teal-600" />
          GST % options
        </CardTitle>
        <CardDescription>
          These percentages appear in the product GST dropdown. GST cannot be typed on a product — choose from this list.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {percents.map((percent) => (
            <span
              key={percent}
              className="inline-flex items-center gap-1 rounded-full border border-teal-200 bg-teal-50 px-2.5 py-1 text-xs font-semibold text-teal-800"
            >
              {gstLabel(percent)}
              <button
                type="button"
                className="rounded-full p-0.5 text-teal-400 hover:bg-white hover:text-red-500"
                onClick={() => void removePercent(percent)}
                disabled={saving}
                title={`Remove ${gstLabel(percent)}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
        <div className="flex max-w-xs items-center gap-2">
          <Input
            type="number"
            min={0}
            max={100}
            placeholder="e.g. 18"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                void addPercent()
              }
            }}
          />
          <Button type="button" size="sm" className="gap-1.5 shrink-0" disabled={saving || !draft} onClick={() => void addPercent()}>
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            Add %
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export function GstPurchaseCatalogDashboard() {
  const {
    catalogs,
    loading,
    syncStatus,
    createCatalog,
    updateCatalogMeta,
    updateCatalogProducts,
    removeCatalog,
    gstPercents,
    updateGstPercents,
    saleMarginPercents,
    updateSaleMarginPercents,
  } = useGstPurchaseCatalog()

  const [selectedCatalog, setSelectedCatalog] = useState<GstPurchaseCatalog | null>(null)
  const [catalogDialogOpen, setCatalogDialogOpen] = useState(false)
  const [editingCatalog, setEditingCatalog] = useState<GstPurchaseCatalog | null>(null)
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
          <p className="text-sm font-medium text-slate-500">Loading GST Purchase Catalogs…</p>
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
          gstPercents={gstPercents}
          salePercents={saleMarginPercents}
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
          <div className="flex items-center gap-2 text-teal-700">
            <Percent className="h-7 w-7 shrink-0" />
            <span className="text-sm font-bold uppercase tracking-widest text-teal-600">GST Purchase Catalog</span>
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 drop-shadow-sm">
            GST Order Catalogs
          </h1>
          <p className="text-sm text-slate-500 font-medium max-w-lg">
            Same catalog groups as Purchase Catalog, with GST % on every product. Choose GST from the dropdown — add new GST slabs below.
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

      <SaleMarginPercentsCard percents={saleMarginPercents} onSave={updateSaleMarginPercents} />
      <GstPercentsCard percents={gstPercents} onSave={updateGstPercents} />

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
              onDownloadPdf={() => downloadCatalogGroupPdf(catalog)}
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
