"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  ClipboardList,
  Cloud,
  Copy,
  Download,
  FileJson,
  Loader2,
  Columns3,
  Package,
  Pencil,
  Plus,
  Search,
  Trash2,
} from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { useOrderManagement, type CatalogSyncStatus } from "@/hooks/use-order-management"
import type { OrderMgmtGroup, OrderMgmtItem, OrderMgmtOrder, OrderMgmtStatus } from "@/lib/features/order-management/models"
import {
  allOrdersAmount,
  formatPcs,
  lineTotal,
  newItemId,
  nextOrderId,
  orderAmount,
  orderPieceCount,
  roundMoney,
  sanitizeItem,
  CATALOG_TABLE_COLUMNS,
  DEFAULT_CATALOG_COLUMNS,
  DEFAULT_ORDER_COLUMNS,
  ORDER_TABLE_COLUMNS,
  type OrderTableColumn,
} from "@/lib/features/order-management/models"
import { downloadOrderPdf } from "@/lib/features/order-management/pdf-export"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

function ExportPdfButton({
  disabled,
  className,
  onExport,
}: {
  disabled: boolean
  className?: string
  onExport: () => void
}) {
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      className={cn("gap-1.5", className)}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation()
        onExport()
      }}
    >
      {disabled ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
      Export PDF
    </Button>
  )
}

function ColumnPicker({
  columns,
  selected,
  onChange,
}: {
  columns: { key: OrderTableColumn; label: string }[]
  selected: OrderTableColumn[]
  onChange: (next: OrderTableColumn[]) => void
}) {
  const toggle = (key: OrderTableColumn, checked: boolean) => {
    if (checked) {
      onChange([...selected, key])
      return
    }
    if (selected.length <= 1) {
      toast.error("Keep at least one column")
      return
    }
    onChange(selected.filter((col) => col !== key))
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" className="gap-2">
          <Columns3 className="h-4 w-4" />
          Columns
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel>Show columns</DropdownMenuLabel>
        {columns.map((col) => (
          <DropdownMenuCheckboxItem
            key={col.key}
            checked={selected.includes(col.key)}
            onSelect={(e) => e.preventDefault()}
            onCheckedChange={(checked) => toggle(col.key, checked === true)}
          >
            {col.label}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

const SAMPLE_IMPORT_JSON = `[
  { "name": "Pen", "brand": "Cello", "buy_rate": 8, "sale_rate": 12 },
  { "name": "Pencil", "brand": "Apsara", "buy_rate": 3, "sale_rate": 5 }
]`

const CARD_COLORS = [
  { label: "Teal", value: "#0d9488" },
  { label: "Indigo", value: "#6366f1" },
  { label: "Violet", value: "#8b5cf6" },
  { label: "Sky", value: "#0ea5e9" },
  { label: "Emerald", value: "#10b981" },
  { label: "Orange", value: "#f97316" },
  { label: "Rose", value: "#f43f5e" },
  { label: "Amber", value: "#f59e0b" },
]

function formatInr(n: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number(n) || 0)
}

function jsonPickString(rec: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const v = rec[key]
    if (typeof v === "string" && v.trim()) return v.trim()
  }
  return ""
}

function jsonPickNumber(rec: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const v = rec[key]
    if (typeof v === "number" && Number.isFinite(v)) return v
    if (typeof v === "string" && v.trim() !== "") {
      const n = Number(v.replace(/,/g, ""))
      if (Number.isFinite(n)) return n
    }
  }
  return null
}

function SyncBadge({ status }: { status: CatalogSyncStatus }) {
  const cfg: Record<CatalogSyncStatus, { text: string; icon: typeof Cloud; spin?: boolean }> = {
    connecting: { text: "Connecting…", icon: Loader2, spin: true },
    synced: { text: "Synced", icon: CheckCircle2 },
    error: { text: "Sync error", icon: AlertCircle },
    offline: { text: "Offline", icon: Cloud },
  }
  const { text, icon: Icon, spin } = cfg[status] ?? cfg.offline
  return (
    <Badge variant={status === "error" ? "destructive" : "outline"} className="gap-1.5 px-3 py-1.5 text-xs font-medium">
      <Icon className={cn("h-3.5 w-3.5", spin && "animate-spin")} />
      {text}
    </Badge>
  )
}

function GroupDialog({
  open,
  onClose,
  onSave,
  initial,
}: {
  open: boolean
  onClose: () => void
  onSave: (name: string, source: string, color: string) => Promise<void>
  initial?: OrderMgmtGroup | null
}) {
  const [name, setName] = useState(initial?.name ?? "")
  const [source, setSource] = useState(initial?.source ?? "")
  const [color, setColor] = useState(initial?.color ?? CARD_COLORS[0].value)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setName(initial?.name ?? "")
    setSource(initial?.source ?? "")
    setColor(initial?.color ?? CARD_COLORS[0].value)
  }, [open, initial])

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
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{initial ? "Edit group" : "New supplier / brand"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="om-name">Name *</Label>
            <Input
              id="om-name"
              placeholder="e.g. Cello, Local Supplier"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="om-source">Source / note</Label>
            <Input
              id="om-source"
              placeholder="e.g. Delhi agency"
              value={source}
              onChange={(e) => setSource(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Card color</Label>
            <div className="flex flex-wrap gap-2">
              {CARD_COLORS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  className={cn(
                    "h-8 w-8 rounded-full border-2 transition-all",
                    color === c.value ? "border-foreground scale-110 shadow-md" : "border-transparent hover:scale-105"
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
          <Button onClick={() => void handleSave()} disabled={!name.trim() || saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {initial ? "Save Changes" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ItemDialog({
  open,
  onClose,
  onSave,
  initial,
}: {
  open: boolean
  onClose: () => void
  onSave: (item: OrderMgmtItem) => Promise<void>
  initial?: OrderMgmtItem | null
}) {
  const [name, setName] = useState("")
  const [brand, setBrand] = useState("")
  const [buyRate, setBuyRate] = useState("")
  const [saleRate, setSaleRate] = useState("")
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setName(initial?.name ?? "")
    setBrand(initial?.brand ?? "")
    setBuyRate(initial ? String(initial.buyRate) : "")
    setSaleRate(initial ? String(initial.saleRate) : "")
    setError("")
  }, [open, initial])

  const handleSave = async () => {
    if (!name.trim()) {
      setError("Name is required")
      return
    }
    const buy = Number(buyRate)
    const sale = Number(saleRate)
    if (!Number.isFinite(buy) || buy < 0) {
      setError("Valid buy rate required")
      return
    }
    if (!Number.isFinite(sale) || sale < 0) {
      setError("Valid sale rate required")
      return
    }
    setSaving(true)
    try {
      await onSave({
        id: initial?.id || newItemId(),
        name: name.trim(),
        brand: brand.trim(),
        buyRate: roundMoney(buy),
        saleRate: roundMoney(sale),
      })
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{initial ? "Edit item" : "Add item"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label>Name *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Product name" />
          </div>
          <div className="space-y-1.5">
            <Label>Brand</Label>
            <Input value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="Brand" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Buy rate *</Label>
              <Input inputMode="decimal" value={buyRate} onChange={(e) => setBuyRate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Sale rate *</Label>
              <Input inputMode="decimal" value={saleRate} onChange={(e) => setSaleRate(e.target.value)} />
            </div>
          </div>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button onClick={() => void handleSave()} disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function JsonImportDialog({
  open,
  onClose,
  onImport,
}: {
  open: boolean
  onClose: () => void
  onImport: (items: OrderMgmtItem[]) => void
}) {
  const [json, setJson] = useState("")
  const [error, setError] = useState("")
  const [preview, setPreview] = useState<OrderMgmtItem[] | null>(null)
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
      let arr: unknown[] = []
      if (Array.isArray(parsed)) arr = parsed
      else if (parsed && typeof parsed === "object") {
        const root = parsed as Record<string, unknown>
        const nested = root.items ?? root.products
        arr = Array.isArray(nested) ? nested : [parsed]
      }
      const mapped: OrderMgmtItem[] = []
      for (const item of arr) {
        if (!item || typeof item !== "object") continue
        const rec = item as Record<string, unknown>
        const name = jsonPickString(rec, ["name", "product_name", "productName", "item"])
        const buy = jsonPickNumber(rec, ["buy_rate", "buyRate", "price", "rate"])
        if (!name || buy === null) {
          setError("Each item needs name and buy_rate (brand and sale_rate optional)")
          return
        }
        const sale = jsonPickNumber(rec, ["sale_rate", "saleRate", "sale_price", "mrp"]) ?? buy
        const next = sanitizeItem({
          name,
          brand: jsonPickString(rec, ["brand", "Brand"]),
          buyRate: buy,
          saleRate: sale,
        })
        if (next) mapped.push(next)
      }
      if (mapped.length === 0) {
        setError("No valid items found in JSON")
        return
      }
      setPreview(mapped)
    } catch {
      setError("Invalid JSON — please check the format")
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          reset()
          onClose()
        }
      }}
    >
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileJson className="h-5 w-5 text-primary" />
            Import items via JSON
          </DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">
          Array of objects with <span className="font-mono">name</span>, <span className="font-mono">brand</span>,{" "}
          <span className="font-mono">buy_rate</span>, <span className="font-mono">sale_rate</span>.
        </p>
        <textarea
          className="min-h-40 w-full rounded-md border bg-muted/30 p-3 font-mono text-xs"
          placeholder='[{"name":"Pen","brand":"Cello","buy_rate":8,"sale_rate":12}]'
          value={json}
          onChange={(e) => setJson(e.target.value)}
        />
        <div className="flex flex-wrap gap-2">
          <input
            ref={fileRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (!file) return
              const reader = new FileReader()
              reader.onload = (ev) => {
                const text = String(ev.target?.result ?? "")
                setJson(text)
                parseJson(text)
              }
              reader.readAsText(file)
            }}
          />
          <Button type="button" variant="outline" onClick={() => fileRef.current?.click()}>
            Upload file
          </Button>
          <Button
            type="button"
            variant="outline"
            className="gap-2"
            onClick={async () => {
              setJson(SAMPLE_IMPORT_JSON)
              setError("")
              setPreview(null)
              try {
                await navigator.clipboard.writeText(SAMPLE_IMPORT_JSON)
                toast.success("Sample JSON copied")
              } catch {
                toast.error("Copied into the editor — clipboard was blocked")
              }
            }}
          >
            <Copy className="h-4 w-4" />
            Copy Sample JSON
          </Button>
          <Button type="button" variant="outline" onClick={() => parseJson(json)}>
            Preview
          </Button>
        </div>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        {preview ? (
          <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">{preview.length} item(s) ready to import</p>
        ) : null}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!preview?.length}
            onClick={() => {
              if (preview?.length) {
                onImport(preview)
                reset()
                onClose()
              }
            }}
          >
            Import
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

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
        <p className="text-sm text-muted-foreground py-2">{message}</p>
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
            {deleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function CreateOrderView({
  items,
  existingOrderIds,
  initialOrder,
  onCancel,
  onSave,
}: {
  items: OrderMgmtItem[]
  existingOrderIds: string[]
  initialOrder?: OrderMgmtOrder | null
  onCancel: () => void
  onSave: (order: OrderMgmtOrder) => Promise<void>
}) {
  const [selected, setSelected] = useState<Record<string, boolean>>(() => {
    const next: Record<string, boolean> = {}
    for (const line of initialOrder?.lines ?? []) {
      if (line.itemId) next[line.itemId] = true
    }
    return next
  })
  const [qty, setQty] = useState<Record<string, string>>(() => {
    const next: Record<string, string> = {}
    for (const line of initialOrder?.lines ?? []) {
      if (line.itemId) next[line.itemId] = String(line.qty)
    }
    return next
  })
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState("")
  const isEdit = Boolean(initialOrder)

  const rows = useMemo(() => {
    return items.map((item, index) => {
      const checked = Boolean(selected[item.id])
      const q = Math.max(0, Math.floor(Number(qty[item.id]) || 0))
      return { item, index, checked, q, total: checked ? lineTotal(item.buyRate, q) : 0 }
    })
  }, [items, qty, selected])

  const visibleRows = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((row) => {
      const id = String(row.index + 1)
      return (
        row.item.name.toLowerCase().includes(q) ||
        row.item.brand.toLowerCase().includes(q) ||
        id.includes(q)
      )
    })
  }, [rows, search])

  const balance = roundMoney(rows.reduce((sum, row) => sum + row.total, 0))
  const selectedCount = rows.filter((row) => row.checked && row.q > 0).length

  const toggle = (id: string, checked: boolean) => {
    setSelected((prev) => ({ ...prev, [id]: checked }))
    setQty((prev) => ({ ...prev, [id]: prev[id] && Number(prev[id]) > 0 ? prev[id] : "1" }))
  }

  const handleSave = async () => {
    const lines = rows
      .filter((row) => row.checked && row.q > 0)
      .map((row) => ({
        itemId: row.item.id,
        name: row.item.name,
        brand: row.item.brand,
        buyRate: row.item.buyRate,
        saleRate: row.item.saleRate,
        qty: row.q,
        total: row.total,
      }))
    if (lines.length === 0) {
      toast.error("Select at least one item with quantity")
      return
    }
    setSaving(true)
    try {
      await onSave({
        id: initialOrder?.id ?? nextOrderId(existingOrderIds),
        status: initialOrder?.status ?? "pending",
        createdAt: initialOrder?.createdAt ?? new Date().toISOString(),
        lines,
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">
            {isEdit ? `Add items to ${initialOrder?.id}` : "Create Order"}
          </h2>
          <p className="text-sm text-muted-foreground">
            {isEdit
              ? "Select more catalog items or change qty. Existing selections are kept."
              : "Select catalog items, enter qty. Total uses Buy Rate × Qty."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 dark:border-amber-800 dark:bg-amber-950/40">
            <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300">Total balance</p>
            <p className="text-lg font-black tabular-nums text-amber-900 dark:text-amber-100">{formatInr(balance)}</p>
          </div>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button disabled={saving || selectedCount === 0} onClick={() => void handleSave()}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {isEdit ? "Update order" : "Save"}
          </Button>
        </div>
      </div>

      {items.length === 0 ? (
        <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          Add items in Catalog first.
        </p>
      ) : (
        <>
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              className="pl-9"
              placeholder="Search by name, brand, or ID…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="overflow-x-auto rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10" />
                <TableHead className="w-14">ID</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Brand</TableHead>
                <TableHead className="text-right">Buy rate</TableHead>
                <TableHead className="text-right">Sale rate</TableHead>
                <TableHead className="w-28 text-right">Qty</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-8 text-center text-sm text-muted-foreground">
                    No items match “{search.trim()}”
                  </TableCell>
                </TableRow>
              ) : (
                visibleRows.map((row) => (
                <TableRow key={row.item.id} className={row.checked ? "bg-primary/10" : undefined}>
                  <TableCell>
                    <Checkbox
                      checked={row.checked}
                      onCheckedChange={(v) => toggle(row.item.id, v === true)}
                      aria-label={`Select ${row.item.name}`}
                    />
                  </TableCell>
                  <TableCell className="font-mono text-muted-foreground">{row.index + 1}</TableCell>
                  <TableCell className="font-semibold">{row.item.name}</TableCell>
                  <TableCell>{row.item.brand || "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatInr(row.item.buyRate)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatInr(row.item.saleRate)}</TableCell>
                  <TableCell>
                    <Input
                      className="h-8 text-right"
                      inputMode="numeric"
                      disabled={!row.checked}
                      value={row.checked ? (qty[row.item.id] ?? "") : ""}
                      onChange={(e) => setQty((prev) => ({ ...prev, [row.item.id]: e.target.value.replace(/\D/g, "") }))}
                    />
                    {row.checked && row.q > 0 ? (
                      <p className="mt-0.5 text-[10px] text-muted-foreground">{formatPcs(row.q)}</p>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">{formatInr(row.total)}</TableCell>
                </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        </>
      )}
    </div>
  )
}

function GroupDetail({
  group,
  onBack,
  onUpdateItems,
  onUpdateOrders,
}: {
  group: OrderMgmtGroup
  onBack: () => void
  onUpdateItems: (items: OrderMgmtItem[]) => Promise<void>
  onUpdateOrders: (orders: OrderMgmtOrder[]) => Promise<void>
}) {
  const [tab, setTab] = useState("orders")
  const [creating, setCreating] = useState(false)
  const [editingOrder, setEditingOrder] = useState<OrderMgmtOrder | null>(null)
  const [qtyEditMode, setQtyEditMode] = useState(false)
  const [qtyDraft, setQtyDraft] = useState<Record<number, string>>({})
  const [savingQty, setSavingQty] = useState(false)
  const [orderColumns, setOrderColumns] = useState<OrderTableColumn[]>(DEFAULT_ORDER_COLUMNS)
  const [catalogColumns, setCatalogColumns] = useState<OrderTableColumn[]>(DEFAULT_CATALOG_COLUMNS)
  const [exportingPdf, setExportingPdf] = useState(false)
  const [itemDialogOpen, setItemDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<OrderMgmtItem | null>(null)
  const [jsonOpen, setJsonOpen] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<
    | { type: "catalog"; id: string; name: string }
    | { type: "order"; id: string }
    | { type: "line"; orderId: string; index: number; name: string }
    | null
  >(null)
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null)

  useEffect(() => {
    if (group.orders.length === 0) {
      setSelectedOrderId(null)
      return
    }
    setSelectedOrderId((current) =>
      current && group.orders.some((o) => o.id === current) ? current : group.orders[group.orders.length - 1].id
    )
    setQtyEditMode(false)
  }, [group.orders])

  const selectedOrder = group.orders.find((o) => o.id === selectedOrderId) ?? null
  const ordersTotal = allOrdersAmount(group.orders)

  const saveItem = async (item: OrderMgmtItem) => {
    const exists = group.items.some((i) => i.id === item.id)
    const next = exists ? group.items.map((i) => (i.id === item.id ? item : i)) : [...group.items, item]
    await onUpdateItems(next)
    toast.success(exists ? "Item updated" : "Item added")
  }

  const importItems = async (items: OrderMgmtItem[]) => {
    await onUpdateItems([...group.items, ...items])
    toast.success(`Imported ${items.length} item(s)`)
  }

  const removeItem = async (id: string) => {
    await onUpdateItems(group.items.filter((i) => i.id !== id))
    toast.success("Catalog item deleted")
  }

  const removeOrder = async (orderId: string) => {
    await onUpdateOrders(group.orders.filter((o) => o.id !== orderId))
    toast.success(`Order ${orderId} deleted`)
  }

  const removeOrderLine = async (orderId: string, lineIndex: number) => {
    const order = group.orders.find((o) => o.id === orderId)
    if (!order) return
    const lines = order.lines.filter((_, i) => i !== lineIndex)
    await onUpdateOrders(group.orders.map((o) => (o.id === orderId ? { ...o, lines } : o)))
    setQtyEditMode(false)
    toast.success("Item removed from order")
  }

  const saveNewOrder = async (order: OrderMgmtOrder) => {
    await onUpdateOrders([...group.orders, order])
    setSelectedOrderId(order.id)
    setCreating(false)
    setEditingOrder(null)
    setTab("orders")
    toast.success(`Order ${order.id} created`)
  }

  const saveEditedOrder = async (order: OrderMgmtOrder) => {
    await onUpdateOrders(group.orders.map((o) => (o.id === order.id ? order : o)))
    setSelectedOrderId(order.id)
    setCreating(false)
    setEditingOrder(null)
    setTab("orders")
    toast.success(`Order ${order.id} updated`)
  }

  const startQtyEdit = (order: OrderMgmtOrder) => {
    const next: Record<number, string> = {}
    order.lines.forEach((line, index) => {
      next[index] = String(line.qty)
    })
    setQtyDraft(next)
    setQtyEditMode(true)
  }

  const saveQtyEdit = async (order: OrderMgmtOrder) => {
    const lines = order.lines
      .map((line, index) => {
        const q = Math.max(0, Math.floor(Number(qtyDraft[index]) || 0))
        return { ...line, qty: q, total: lineTotal(line.buyRate, q) }
      })
      .filter((line) => line.qty > 0)
    setSavingQty(true)
    try {
      await onUpdateOrders(group.orders.map((o) => (o.id === order.id ? { ...o, lines } : o)))
      setQtyEditMode(false)
      toast.success("Quantities updated")
    } finally {
      setSavingQty(false)
    }
  }

  const setOrderStatus = async (orderId: string, status: OrderMgmtStatus) => {
    await onUpdateOrders(group.orders.map((o) => (o.id === orderId ? { ...o, status } : o)))
    toast.success(`Order ${orderId} marked ${status}`)
  }

  const showOrderCol = (key: OrderTableColumn) => orderColumns.includes(key) || (qtyEditMode && key === "qty")
  const showCatalogCol = (key: OrderTableColumn) => catalogColumns.includes(key)

  const exportSelectedOrder = async (order: OrderMgmtOrder) => {
    setExportingPdf(true)
    try {
      downloadOrderPdf(group, order, orderColumns)
      toast.success("PDF downloaded")
    } catch (e) {
      console.error(e)
      toast.error(e instanceof Error ? e.message : "PDF export failed")
    } finally {
      setExportingPdf(false)
    }
  }

  if (creating || editingOrder) {
    return (
      <div className="space-y-6">
        <Button
          variant="ghost"
          className="gap-2 px-0"
          onClick={() => {
            setCreating(false)
            setEditingOrder(null)
          }}
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <CreateOrderView
          items={group.items}
          existingOrderIds={group.orders.map((o) => o.id)}
          initialOrder={editingOrder}
          onCancel={() => {
            setCreating(false)
            setEditingOrder(null)
          }}
          onSave={editingOrder ? saveEditedOrder : saveNewOrder}
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Button variant="ghost" className="mb-2 gap-2 px-0" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
            All groups
          </Button>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground">{group.name}</h1>
          {group.source ? <p className="text-sm text-muted-foreground">{group.source}</p> : null}
        </div>
        <Button className="gap-2" onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4" />
          Create Order
        </Button>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="orders">Orders</TabsTrigger>
          <TabsTrigger value="catalog">Catalog</TabsTrigger>
        </TabsList>

        <TabsContent value="catalog" className="space-y-4">
          <div className="flex flex-wrap justify-end gap-2">
            <ColumnPicker columns={CATALOG_TABLE_COLUMNS} selected={catalogColumns} onChange={setCatalogColumns} />
            <Button variant="outline" className="gap-2" onClick={() => setJsonOpen(true)}>
              <FileJson className="h-4 w-4" />
              JSON import
            </Button>
            <Button
              className="gap-2"
              onClick={() => {
                setEditingItem(null)
                setItemDialogOpen(true)
              }}
            >
              <Plus className="h-4 w-4" />
              Add item
            </Button>
          </div>
          {group.items.length === 0 ? (
            <p className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
              No catalog items yet. Add one or import JSON.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-xl border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    {showCatalogCol("id") ? <TableHead className="w-14">ID</TableHead> : null}
                    {showCatalogCol("name") ? <TableHead>Name</TableHead> : null}
                    {showCatalogCol("brand") ? <TableHead>Brand</TableHead> : null}
                    {showCatalogCol("buyRate") ? <TableHead className="text-right">Buy rate</TableHead> : null}
                    {showCatalogCol("saleRate") ? <TableHead className="text-right">Sale rate</TableHead> : null}
                    <TableHead className="w-36 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {group.items.map((item, index) => (
                    <TableRow key={item.id}>
                      {showCatalogCol("id") ? (
                        <TableCell className="font-mono text-muted-foreground">{index + 1}</TableCell>
                      ) : null}
                      {showCatalogCol("name") ? <TableCell className="font-semibold">{item.name}</TableCell> : null}
                      {showCatalogCol("brand") ? <TableCell>{item.brand || "—"}</TableCell> : null}
                      {showCatalogCol("buyRate") ? (
                        <TableCell className="text-right tabular-nums">{formatInr(item.buyRate)}</TableCell>
                      ) : null}
                      {showCatalogCol("saleRate") ? (
                        <TableCell className="text-right tabular-nums">{formatInr(item.saleRate)}</TableCell>
                      ) : null}
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="h-8 gap-1 px-2"
                            onClick={() => {
                              setEditingItem(item)
                              setItemDialogOpen(true)
                            }}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            Edit
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="h-8 gap-1 px-2 text-destructive hover:bg-destructive/10 hover:text-destructive"
                            onClick={() => setPendingDelete({ type: "catalog", id: item.id, name: item.name })}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Delete
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="orders" className="space-y-4">
          <div className="rounded-xl border bg-muted/40 px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Amount of all orders</p>
            <p className="text-2xl font-black tabular-nums text-foreground">{formatInr(ordersTotal)}</p>
          </div>

          {group.orders.length === 0 ? (
            <p className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
              No orders yet. Use Create Order to pick items from the catalog.
            </p>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {[...group.orders].reverse().map((order) => {
                  const active = order.id === selectedOrderId
                  return (
                    <div
                      key={order.id}
                      className={cn(
                        "rounded-2xl border bg-card p-4 text-left shadow-sm transition-all",
                        active
                          ? "border-primary ring-2 ring-primary/30"
                          : "border-border hover:border-primary/40 hover:shadow-md"
                      )}
                    >
                      <button
                        type="button"
                        className="w-full text-left"
                        onClick={() => {
                          setSelectedOrderId(order.id)
                          setQtyEditMode(false)
                        }}
                      >
                        <p className="font-bold text-foreground">{order.id}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                        {formatInr(orderAmount(order))} · {formatPcs(orderPieceCount(order))}
                      </p>
                        <Badge
                          className={cn(
                            "mt-2",
                            order.status === "delivered"
                              ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-300 dark:hover:bg-emerald-950"
                              : "bg-amber-100 text-amber-800 hover:bg-amber-100 dark:bg-amber-950 dark:text-amber-300 dark:hover:bg-amber-950"
                          )}
                        >
                          {order.status === "delivered" ? "Delivered" : "Pending"}
                        </Badge>
                      </button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="mt-3 w-full gap-1.5"
                        onClick={(e) => {
                          e.stopPropagation()
                          setSelectedOrderId(order.id)
                          setQtyEditMode(false)
                          setEditingOrder(order)
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Edit order
                      </Button>
                      <ExportPdfButton
                        className="mt-2 w-full"
                        disabled={exportingPdf}
                        onExport={() => void exportSelectedOrder(order)}
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="mt-1 w-full gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation()
                          setPendingDelete({ type: "order", id: order.id })
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete order
                      </Button>
                    </div>
                  )
                })}
              </div>

              {selectedOrder ? (
                <div className="space-y-3 rounded-xl border bg-card p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-bold">Order {selectedOrder.id}</h3>
                      <p className="text-sm text-muted-foreground">
                        Total {formatInr(orderAmount(selectedOrder))} · {formatPcs(orderPieceCount(selectedOrder))}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-end gap-2">
                      <ColumnPicker columns={ORDER_TABLE_COLUMNS} selected={orderColumns} onChange={setOrderColumns} />
                      <ExportPdfButton
                        disabled={exportingPdf}
                        onExport={() => void exportSelectedOrder(selectedOrder)}
                      />
                      {qtyEditMode ? (
                        <>
                          <Button type="button" variant="outline" onClick={() => setQtyEditMode(false)}>
                            Cancel
                          </Button>
                          <Button
                            type="button"
                            disabled={savingQty}
                            onClick={() => void saveQtyEdit(selectedOrder)}
                          >
                            {savingQty ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            Save quantities
                          </Button>
                        </>
                      ) : (
                        <Button type="button" variant="outline" className="gap-1.5" onClick={() => startQtyEdit(selectedOrder)}>
                          <Pencil className="h-3.5 w-3.5" />
                          Edit items
                        </Button>
                      )}
                      <div className="w-44">
                        <Label className="mb-1 block text-xs">Status</Label>
                        <Select
                          value={selectedOrder.status}
                          onValueChange={(v) => void setOrderStatus(selectedOrder.id, v as OrderMgmtStatus)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pending">Pending</SelectItem>
                            <SelectItem value="delivered">Delivered</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        className="gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => setPendingDelete({ type: "order", id: selectedOrder.id })}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete order
                      </Button>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {showOrderCol("id") ? <TableHead className="w-14">ID</TableHead> : null}
                          {showOrderCol("name") ? <TableHead>Name</TableHead> : null}
                          {showOrderCol("brand") ? <TableHead>Brand</TableHead> : null}
                          {showOrderCol("buyRate") ? <TableHead className="text-right">Buy rate</TableHead> : null}
                          {showOrderCol("saleRate") ? <TableHead className="text-right">Sale rate</TableHead> : null}
                          {showOrderCol("qty") ? <TableHead className="w-28 text-right">Qty</TableHead> : null}
                          {showOrderCol("total") ? <TableHead className="text-right">Total</TableHead> : null}
                          <TableHead className="w-24 text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedOrder.lines.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={8} className="py-8 text-center text-sm text-muted-foreground">
                              No items on this order. Use Edit order to add items, or delete the order.
                            </TableCell>
                          </TableRow>
                        ) : (
                        selectedOrder.lines.map((line, index) => {
                          const q = qtyEditMode
                            ? Math.max(0, Math.floor(Number(qtyDraft[index]) || 0))
                            : line.qty
                          const total = qtyEditMode ? lineTotal(line.buyRate, q) : line.total
                          return (
                          <TableRow key={`${line.itemId}-${index}`}>
                            {showOrderCol("id") ? (
                              <TableCell className="font-mono text-muted-foreground">{index + 1}</TableCell>
                            ) : null}
                            {showOrderCol("name") ? <TableCell className="font-semibold">{line.name}</TableCell> : null}
                            {showOrderCol("brand") ? <TableCell>{line.brand || "—"}</TableCell> : null}
                            {showOrderCol("buyRate") ? (
                              <TableCell className="text-right tabular-nums">{formatInr(line.buyRate)}</TableCell>
                            ) : null}
                            {showOrderCol("saleRate") ? (
                              <TableCell className="text-right tabular-nums">{formatInr(line.saleRate)}</TableCell>
                            ) : null}
                            {showOrderCol("qty") ? (
                            <TableCell className="text-right">
                              {qtyEditMode ? (
                                <div>
                                  <Input
                                    className="ml-auto h-8 w-24 text-right"
                                    inputMode="numeric"
                                    value={qtyDraft[index] ?? ""}
                                    onChange={(e) =>
                                      setQtyDraft((prev) => ({
                                        ...prev,
                                        [index]: e.target.value.replace(/\D/g, ""),
                                      }))
                                    }
                                  />
                                  {q > 0 ? (
                                    <p className="mt-0.5 text-[10px] text-muted-foreground">{formatPcs(q)}</p>
                                  ) : null}
                                </div>
                              ) : (
                                <span className="tabular-nums">{formatPcs(line.qty)}</span>
                              )}
                            </TableCell>
                            ) : null}
                            {showOrderCol("total") ? (
                              <TableCell className="text-right font-semibold tabular-nums">{formatInr(total)}</TableCell>
                            ) : null}
                            <TableCell className="text-right">
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                className="h-8 gap-1 px-2 text-destructive hover:bg-destructive/10 hover:text-destructive"
                                onClick={() =>
                                  setPendingDelete({
                                    type: "line",
                                    orderId: selectedOrder.id,
                                    index,
                                    name: line.name,
                                  })
                                }
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                Delete
                              </Button>
                            </TableCell>
                          </TableRow>
                          )
                        })
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              ) : null}
            </>
          )}
        </TabsContent>
      </Tabs>

      <ItemDialog
        open={itemDialogOpen}
        initial={editingItem}
        onClose={() => {
          setItemDialogOpen(false)
          setEditingItem(null)
        }}
        onSave={saveItem}
      />
      <JsonImportDialog open={jsonOpen} onClose={() => setJsonOpen(false)} onImport={(items) => void importItems(items)} />
      {pendingDelete ? (
        <ConfirmDeleteDialog
          open
          title={
            pendingDelete.type === "order"
              ? "Delete order"
              : pendingDelete.type === "line"
                ? "Remove item from order"
                : "Delete catalog item"
          }
          message={
            pendingDelete.type === "order"
              ? `Delete order ${pendingDelete.id}? All items on this order will be removed.`
              : pendingDelete.type === "line"
                ? `Remove "${pendingDelete.name}" from this order?`
                : `Remove "${pendingDelete.name}" from the catalog? Existing orders keep their copies of this item.`
          }
          onConfirm={async () => {
            if (pendingDelete.type === "order") await removeOrder(pendingDelete.id)
            else if (pendingDelete.type === "line") await removeOrderLine(pendingDelete.orderId, pendingDelete.index)
            else await removeItem(pendingDelete.id)
          }}
          onClose={() => setPendingDelete(null)}
        />
      ) : null}
    </div>
  )
}

export function OrderManagementDashboard() {
  const { groups, loading, syncStatus, createGroup, updateGroupMeta, updateGroupItems, updateGroupOrders, removeGroup } =
    useOrderManagement()
  const [search, setSearch] = useState("")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<OrderMgmtGroup | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const live = selectedId ? groups.find((g) => g.id === selectedId) ?? null : null
  const filtered = groups.filter(
    (g) =>
      g.name.toLowerCase().includes(search.toLowerCase()) ||
      (g.source ?? "").toLowerCase().includes(search.toLowerCase())
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="text-sm font-medium text-muted-foreground">Loading Order Management…</p>
        </div>
      </div>
    )
  }

  if (live) {
    return (
      <div className="mx-auto w-full max-w-[1400px] space-y-8 pb-10">
        <GroupDetail
          group={live}
          onBack={() => setSelectedId(null)}
          onUpdateItems={(items) => updateGroupItems(live.id, items)}
          onUpdateOrders={(orders) => updateGroupOrders(live.id, orders)}
        />
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-8 pb-10">
      <div className="flex flex-col gap-6 border-b pb-8 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="flex items-center gap-2 text-teal-700 dark:text-teal-400">
            <ClipboardList className="h-7 w-7 shrink-0" />
            <span className="text-sm font-bold uppercase tracking-widest text-teal-600 dark:text-teal-400">Order Management</span>
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight text-foreground">Supplier & brand cards</h1>
          <p className="max-w-lg text-sm font-medium text-muted-foreground">
            Create a card for each supplier or brand. Open it to manage Catalog items and Orders.
          </p>
          <div className="flex items-center gap-2 pt-1">
            <SyncBadge status={syncStatus} />
            <Badge variant="outline" className="px-3 py-1 font-semibold">
              {groups.length} group{groups.length !== 1 ? "s" : ""}
            </Badge>
          </div>
        </div>
        <Button
          onClick={() => {
            setEditing(null)
            setDialogOpen(true)
          }}
          className="gap-2 bg-gradient-to-r from-indigo-500 to-violet-600 text-white hover:from-indigo-600 hover:to-violet-700"
        >
          <Plus className="h-4 w-4" />
          New card
        </Button>
      </div>

      {groups.length > 0 ? (
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search cards…" className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      ) : null}

      {groups.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-6 rounded-3xl border-2 border-dashed bg-muted/20 py-24 text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-muted">
            <Package className="h-9 w-9 text-primary" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-bold text-foreground">No cards yet</h2>
            <p className="max-w-sm text-sm text-muted-foreground">Add a supplier or brand card to start a catalog and orders.</p>
          </div>
          <Button
            onClick={() => setDialogOpen(true)}
            className="gap-2 bg-gradient-to-r from-indigo-500 to-violet-600 text-white"
          >
            <Plus className="h-4 w-4" />
            Create first card
          </Button>
        </div>
      ) : null}

      {filtered.length > 0 ? (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {filtered.map((group) => {
            const color = group.color || "#0d9488"
            return (
              <div
                key={group.id}
                className="group relative cursor-pointer overflow-hidden rounded-2xl border bg-card shadow-md transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
                onClick={() => setSelectedId(group.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === "Enter" && setSelectedId(group.id)}
              >
                <div className="h-2 w-full" style={{ backgroundColor: color }} />
                <div className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <div
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
                        style={{ backgroundColor: `${color}22` }}
                      >
                        <Package className="h-5 w-5" style={{ color }} />
                      </div>
                      <div className="min-w-0">
                        <h3 className="truncate text-base font-bold text-foreground">{group.name}</h3>
                        {group.source ? <p className="mt-0.5 truncate text-xs font-medium text-muted-foreground">{group.source}</p> : null}
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                        onClick={() => {
                          setEditing(group)
                          setDialogOpen(true)
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => setDeletingId(group.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <div className="rounded-lg border bg-muted/40 px-3 py-2 text-center">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Catalog</p>
                      <p className="text-sm font-black text-foreground">{group.items.length}</p>
                    </div>
                    <div className="rounded-lg border px-3 py-2 text-center" style={{ backgroundColor: `${color}11`, borderColor: `${color}33` }}>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300">Orders</p>
                      <p className="text-sm font-black text-amber-900 dark:text-amber-100">{group.orders.length}</p>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      ) : null}

      <GroupDialog
        open={dialogOpen}
        initial={editing}
        onClose={() => {
          setDialogOpen(false)
          setEditing(null)
        }}
        onSave={async (name, source, color) => {
          if (editing) await updateGroupMeta(editing.id, name, source, color)
          else await createGroup(name, source, color)
        }}
      />
      {deletingId ? (
        <ConfirmDeleteDialog
          open
          title="Delete card"
          message={`Delete "${groups.find((g) => g.id === deletingId)?.name}"? Catalog items and orders inside will be removed.`}
          onConfirm={() => removeGroup(deletingId)}
          onClose={() => setDeletingId(null)}
        />
      ) : null}
    </div>
  )
}
