"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { format } from "date-fns"
import {
  Box,
  ChevronDown,
  FilePenLine,
  Inbox,
  Pencil,
  Search,
  ShieldCheck,
  Trash2,
} from "lucide-react"
import { toast } from "sonner"
import { TEST_ACCOUNT_PASSKEY } from "@/lib/account-mode"
import { useDraftProducts } from "@/hooks/use-firestore"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { Product } from "@/lib/types"
import { barcodesMatch } from "@/lib/stock"
import {
  inventoryTableFrameClassName,
  invTableCellClass,
  invTableCellNumeric,
  invTableHeadClass,
} from "@/lib/inventory-ui"
import { STATUS_OPTIONS } from "@/lib/status-options"
import { cn } from "@/lib/utils"
import { gstLabel } from "@/lib/inventory/gst-percent"
import {
  countDraftAuditOk,
  defaultLineBillTotal,
  loadDraftAuditCosts,
  loadDraftAuditOk,
  loadDraftAuditUnitCosts,
  pruneDraftAuditCosts,
  pruneDraftAuditOk,
  pruneDraftAuditUnitCosts,
  roundMoney,
  setDraftAuditCost,
  setDraftAuditOk,
  setDraftAuditUnitCost,
  unitCostFromBillTotal,
  type DraftAuditCostMap,
  type DraftAuditOkMap,
  type DraftAuditUnitCostMap,
} from "@/lib/draft-entry-audit-costs"
import { useClientHydrated } from "@/hooks/use-client-hydrated"
import { isRestrictedStaff, useSessionUser } from "@/lib/auth-session"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { Badge } from "@/components/ui/badge"
import {
  draftGroupedAccountLabel,
  draftOwnedBySessionAccount,
} from "@/lib/draft-account"

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount)
}

function resolveDraftUnitCost(product: Product, unitMap: DraftAuditUnitCostMap): number {
  if (unitMap[product.id] != null) return unitMap[product.id]!
  return product.costPrice ?? 0
}

function resolveDraftBillTotal(
  product: Product,
  costMap: DraftAuditCostMap,
  unitMap: DraftAuditUnitCostMap
): number {
  const explicit = costMap[product.id]
  if (explicit != null && Number.isFinite(explicit) && explicit >= 0) return explicit
  return defaultLineBillTotal(product.stock, resolveDraftUnitCost(product, unitMap))
}

export default function DraftEntriesPage() {
  const hydrated = useClientHydrated()
  const { user } = useSessionUser()
  const isStaffAccount = user ? isRestrictedStaff(user) : false
  const isMainAdmin = user?.role === "admin"
  const { drafts, loading, updateDraftStatus, updateDraft, approveDraft, deleteDraft } =
    useDraftProducts()
  const [search, setSearch] = useState("")
  const [categoryFilter, setCategoryFilter] = useState<string>("all")
  const [auditMode, setAuditMode] = useState(false)
  const [auditDialogOpen, setAuditDialogOpen] = useState(false)
  const [auditPassword, setAuditPassword] = useState("")
  const [approvingId, setApprovingId] = useState<string | null>(null)
  const [statusSavingId, setStatusSavingId] = useState<string | null>(null)
  const [draftToDelete, setDraftToDelete] = useState<Product | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [auditCosts, setAuditCosts] = useState<DraftAuditCostMap>({})
  const [auditCostDraft, setAuditCostDraft] = useState<Record<string, string>>({})
  const [auditUnitCosts, setAuditUnitCosts] = useState<DraftAuditUnitCostMap>({})
  const [auditUnitCostDraft, setAuditUnitCostDraft] = useState<Record<string, string>>({})
  const [auditOk, setAuditOk] = useState<DraftAuditOkMap>({})
  const [auditLocalReady, setAuditLocalReady] = useState(false)

  useEffect(() => {
    if (!hydrated) return
    const loaded = loadDraftAuditCosts()
    const loadedOk = loadDraftAuditOk()
    const loadedUnit = loadDraftAuditUnitCosts()
    setAuditCosts(loaded)
    setAuditOk(loadedOk)
    setAuditUnitCosts(loadedUnit)
    setAuditCostDraft(() => {
      const draftStrings: Record<string, string> = {}
      for (const [id, amount] of Object.entries(loaded)) {
        if (amount > 0) draftStrings[id] = String(amount)
      }
      return draftStrings
    })
    setAuditLocalReady(true)
  }, [hydrated])

  useEffect(() => {
    if (!auditLocalReady) return
    const ids = drafts.map((d) => d.id)
    const pruned = pruneDraftAuditCosts(ids)
    const prunedOk = pruneDraftAuditOk(ids)
    const prunedUnit = pruneDraftAuditUnitCosts(ids)
    setAuditCosts(pruned)
    setAuditOk(prunedOk)
    setAuditUnitCosts(prunedUnit)
    setAuditCostDraft((prev) => {
      const next: Record<string, string> = {}
      for (const id of ids) {
        const fromPrev = prev[id]
        if (fromPrev !== undefined) {
          next[id] = fromPrev
        } else if (pruned[id] != null && pruned[id]! > 0) {
          next[id] = String(pruned[id])
        }
      }
      return next
    })
    setAuditUnitCostDraft((prev) => {
      const next: Record<string, string> = {}
      for (const id of ids) {
        const fromPrev = prev[id]
        if (fromPrev !== undefined) {
          next[id] = fromPrev
        } else if (prunedUnit[id] != null) {
          next[id] = String(prunedUnit[id])
        }
      }
      return next
    })
  }, [drafts, auditLocalReady])

  const categories = useMemo(() => {
    const cats = [...new Set(drafts.map((p) => p.category))]
    return cats.filter(Boolean).sort()
  }, [drafts])

  const filteredDrafts = useMemo(() => {
    const q = search.trim()
    const qLower = q.toLowerCase()
    return drafts.filter((product) => {
      if (isStaffAccount && !draftOwnedBySessionAccount(product, user?.accountTag)) {
        return false
      }
      const matchesSearch =
        !q ||
        product.name.toLowerCase().includes(qLower) ||
        (product.barcode != null &&
          (barcodesMatch(product.barcode, q) || product.barcode.toLowerCase().includes(qLower))) ||
        draftGroupedAccountLabel(product).toLowerCase().includes(qLower)
      const matchesCategory = categoryFilter === "all" || product.category === categoryFilter
      return matchesSearch && matchesCategory
    })
  }, [drafts, search, categoryFilter, isStaffAccount, user?.accountTag])

  const groupedByAccount = useMemo(() => {
    if (!isMainAdmin) return null
    const map = new Map<string, Product[]>()
    for (const product of filteredDrafts) {
      const key = draftGroupedAccountLabel(product)
      const list = map.get(key) ?? []
      list.push(product)
      map.set(key, list)
    }
    return [...map.entries()].sort(([a], [b]) =>
      a.localeCompare(b, undefined, { sensitivity: "base" })
    )
  }, [filteredDrafts, isMainAdmin])

  const filteredDraftIds = useMemo(() => filteredDrafts.map((d) => d.id), [filteredDrafts])

  const totalAuditBillCost = useMemo(() => {
    if (!auditLocalReady) return 0
    return filteredDrafts.reduce(
      (sum, p) => sum + resolveDraftBillTotal(p, auditCosts, auditUnitCosts),
      0
    )
  }, [auditLocalReady, filteredDrafts, auditCosts, auditUnitCosts])

  const okMarkedCount = useMemo(
    () => (auditLocalReady ? countDraftAuditOk(filteredDraftIds, auditOk) : 0),
    [auditLocalReady, filteredDraftIds, auditOk]
  )

  const okMarkedBillTotal = useMemo(() => {
    if (!auditLocalReady) return 0
    return filteredDrafts.reduce((sum, p) => {
      if (auditOk[p.id] !== true) return sum
      return sum + resolveDraftBillTotal(p, auditCosts, auditUnitCosts)
    }, 0)
  }, [auditLocalReady, filteredDrafts, auditOk, auditCosts, auditUnitCosts])

  const clearAuditLineOverrides = (draftId: string) => {
    setAuditCosts(setDraftAuditCost(draftId, null))
    setAuditUnitCosts(setDraftAuditUnitCost(draftId, null))
    setAuditOk(setDraftAuditOk(draftId, false))
    setAuditCostDraft((prev) => {
      const next = { ...prev }
      delete next[draftId]
      return next
    })
    setAuditUnitCostDraft((prev) => {
      const next = { ...prev }
      delete next[draftId]
      return next
    })
  }

  const commitAuditCost = (product: Product, raw: string) => {
    const draftId = product.id
    const trimmed = raw.trim()
    if (!trimmed) {
      setAuditCosts(setDraftAuditCost(draftId, null))
      setAuditUnitCosts(setDraftAuditUnitCost(draftId, null))
      setAuditUnitCostDraft((prev) => {
        const next = { ...prev }
        delete next[draftId]
        return next
      })
      return
    }
    const n = parseFloat(trimmed)
    if (!Number.isFinite(n) || n < 0) {
      toast.error("Enter a valid bill total")
      return
    }
    const total = roundMoney(n)
    setAuditCosts(setDraftAuditCost(draftId, total))
    const unit = unitCostFromBillTotal(total, product.stock)
    if (product.stock > 0) {
      setAuditUnitCosts(setDraftAuditUnitCost(draftId, unit))
      setAuditUnitCostDraft((prev) => ({ ...prev, [draftId]: String(unit) }))
    }
  }

  const commitAuditUnitCost = (product: Product, raw: string) => {
    const draftId = product.id
    const trimmed = raw.trim()
    if (!trimmed) {
      setAuditUnitCosts(setDraftAuditUnitCost(draftId, null))
      setAuditCosts(setDraftAuditCost(draftId, null))
      setAuditCostDraft((prev) => {
        const next = { ...prev }
        delete next[draftId]
        return next
      })
      return
    }
    const n = parseFloat(trimmed)
    if (!Number.isFinite(n) || n < 0) {
      toast.error("Enter a valid unit cost")
      return
    }
    const unit = roundMoney(n)
    setAuditUnitCosts(setDraftAuditUnitCost(draftId, unit))
    const total = defaultLineBillTotal(product.stock, unit)
    setAuditCosts(setDraftAuditCost(draftId, total))
    setAuditCostDraft((prev) => ({ ...prev, [draftId]: String(total) }))
  }

  const startAudit = () => {
    if (auditPassword.trim() !== TEST_ACCOUNT_PASSKEY) {
      toast.error("Wrong password")
      return
    }
    setAuditMode(true)
    setAuditDialogOpen(false)
    setAuditPassword("")
    toast.success("Audit mode enabled")
  }

  const endAudit = () => {
    setAuditMode(false)
    toast.message("Audit mode ended")
  }

  const handleStatusChange = async (product: Product, status: string) => {
    if (!auditMode) return
    setStatusSavingId(product.id)
    try {
      await updateDraftStatus(product.id, status)
    } catch (error) {
      console.error(error)
      toast.error(error instanceof Error ? error.message : "Failed to update status")
    } finally {
      setStatusSavingId(null)
    }
  }

  const handleApprove = async (product: Product) => {
    if (!auditMode) return
    setApprovingId(product.id)
    try {
      const rowStatus =
        product.status && STATUS_OPTIONS.includes(product.status as (typeof STATUS_OPTIONS)[number])
          ? product.status
          : "deactive"
      const unitCost = resolveDraftUnitCost(product, auditUnitCosts)
      const totalCost = resolveDraftBillTotal(product, auditCosts, auditUnitCosts)
      const noExpiry = product.stock > 0 && !product.expiry ? true : undefined

      await updateDraft(product.id, {
        name: product.name,
        category: product.category,
        rack: product.rack,
        tag: product.tag,
        status: rowStatus,
        price: product.price,
        costPrice: unitCost,
        totalCost,
        stock: product.stock,
        unit: product.unit,
        minStock: product.minStock,
        barcode: product.barcode,
        brand: product.brand,
        supplierName: product.supplierName,
        supplierContact: product.supplierContact,
        mrp: product.mrp,
        discountPercent: product.discountPercent,
        gstPercent: product.gstPercent,
        expiry: product.expiry,
        noExpiry,
        imageUrl: product.imageUrl,
      })
      await approveDraft(product.id)
      clearAuditLineOverrides(product.id)
      toast.success(`${product.name} approved and moved to All Products`)
    } catch (error) {
      console.error(error)
      toast.error(error instanceof Error ? error.message : "Failed to approve")
    } finally {
      setApprovingId(null)
    }
  }

  const handleConfirmDelete = async () => {
    if (!draftToDelete || !auditMode) return
    setDeletingId(draftToDelete.id)
    try {
      await deleteDraft(draftToDelete.id)
      clearAuditLineOverrides(draftToDelete.id)
      toast.success(`Removed "${draftToDelete.name}" from draft list`)
      setDraftToDelete(null)
    } catch (error) {
      console.error(error)
      toast.error(error instanceof Error ? error.message : "Failed to delete")
    } finally {
      setDeletingId(null)
    }
  }

  const renderDraftProductRow = (product: Product) => {
    const rowStatus =
      product.status && STATUS_OPTIONS.includes(product.status as (typeof STATUS_OPTIONS)[number])
        ? product.status
        : "deactive"
    const resolvedUnit = resolveDraftUnitCost(product, auditUnitCosts)
    const resolvedBill = resolveDraftBillTotal(product, auditCosts, auditUnitCosts)
    return (
      <TableRow
        key={product.id}
        className="border-border/50 transition-colors hover:bg-muted/40"
      >
        <TableCell className={cn(invTableCellClass, "text-center")}>
          <label className="inline-flex cursor-pointer flex-col items-center gap-1">
            <Checkbox
              checked={auditLocalReady && auditOk[product.id] === true}
              onCheckedChange={(checked) =>
                setAuditOk(setDraftAuditOk(product.id, checked === true))
              }
              disabled={!auditLocalReady}
              aria-label={`Mark ${product.name} as OK for bill match`}
            />
            <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              OK
            </span>
          </label>
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
        <TableCell
          className={cn(invTableCellNumeric, "hidden lg:table-cell text-muted-foreground text-sm")}
        >
          {product.gstPercent != null ? gstLabel(product.gstPercent) : "—"}
        </TableCell>
        <TableCell className={invTableCellNumeric}>
          <span className="font-semibold">{product.stock}</span>
          <span className="ml-1 text-muted-foreground">{product.unit}</span>
        </TableCell>
        <TableCell className={cn(invTableCellClass, "text-right")}>
          <Input
            type="number"
            min={0}
            step="0.01"
            inputMode="decimal"
            placeholder="0"
            className="ml-auto h-9 w-[7.5rem] text-right tabular-nums"
            value={
              !auditLocalReady
                ? ""
                : auditUnitCostDraft[product.id] ??
                  (auditUnitCosts[product.id] != null
                    ? String(auditUnitCosts[product.id])
                    : resolvedUnit > 0
                      ? String(resolvedUnit)
                      : "")
            }
            onChange={(e) =>
              setAuditUnitCostDraft((prev) => ({
                ...prev,
                [product.id]: e.target.value,
              }))
            }
            onBlur={(e) => commitAuditUnitCost(product, e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                commitAuditUnitCost(product, e.currentTarget.value)
              }
            }}
          />
        </TableCell>
        <TableCell className={cn(invTableCellClass, "text-right")}>
          <Input
            type="number"
            min={0}
            step="0.01"
            inputMode="decimal"
            placeholder="0"
            className="ml-auto h-9 w-[7.5rem] text-right tabular-nums"
            value={
              !auditLocalReady
                ? ""
                : auditCostDraft[product.id] ??
                  (auditCosts[product.id] != null
                    ? String(auditCosts[product.id])
                    : resolvedBill > 0
                      ? String(resolvedBill)
                      : "")
            }
            onChange={(e) =>
              setAuditCostDraft((prev) => ({
                ...prev,
                [product.id]: e.target.value,
              }))
            }
            onBlur={(e) => commitAuditCost(product, e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                commitAuditCost(product, e.currentTarget.value)
              }
            }}
          />
        </TableCell>
        <TableCell
          className={cn(invTableCellClass, "hidden sm:table-cell text-muted-foreground")}
          suppressHydrationWarning
        >
          {format(product.createdAt, "MMM dd, yyyy")}
        </TableCell>
        <TableCell className={invTableCellClass}>
          <Select
            value={rowStatus}
            disabled={isStaffAccount || !auditMode || statusSavingId === product.id}
            onValueChange={(value) => void handleStatusChange(product, value)}
          >
            <SelectTrigger className="h-9 w-[7.5rem]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="deactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </TableCell>
        <TableCell className={cn(invTableCellClass, "pr-4 text-right")}>
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" size="sm" variant="outline" asChild>
              <Link href={`/draft-entries/edit/${product.id}`}>
                <Pencil className="mr-1 h-3.5 w-3.5" />
                Edit
              </Link>
            </Button>
            {!isStaffAccount ? (
              <>
                <Button
                  type="button"
                  size="sm"
                  disabled={!auditMode || approvingId === product.id}
                  onClick={() => void handleApprove(product)}
                >
                  {approvingId === product.id ? "…" : "Approve"}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="text-destructive hover:text-destructive"
                  disabled={!auditMode || deletingId === product.id}
                  onClick={() => setDraftToDelete(product)}
                >
                  <Trash2 className="mr-1 h-3.5 w-3.5" />
                  Delete
                </Button>
              </>
            ) : null}
          </div>
        </TableCell>
      </TableRow>
    )
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl space-y-6 pb-10">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-[420px]" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl space-y-8 pb-10">
      <div className="flex flex-col gap-6 border-b border-border/60 pb-8 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-primary">
            <FilePenLine className="h-7 w-7" aria-hidden />
            <span className="text-sm font-medium uppercase tracking-wide">Draft Entries</span>
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">Pending product audit</h1>
          <p className="max-w-2xl text-muted-foreground">
            {isStaffAccount
              ? "Your pending products — only rows created under your account are shown."
              : "New items stay here until you audit and approve them into Inventory → All Products. Grouped by staff account."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {!isStaffAccount ? (
            auditMode ? (
              <Button type="button" variant="outline" onClick={endAudit}>
                End audit
              </Button>
            ) : (
              <Button type="button" className="gap-2" onClick={() => setAuditDialogOpen(true)}>
                <ShieldCheck className="h-4 w-4" />
                Start audit
              </Button>
            )
          ) : null}
          <Button asChild variant="outline">
            <Link href="/inventory/add">Add product & batch</Link>
          </Button>
        </div>
      </div>

      <Card className="border-border/80 shadow-sm">
        <CardHeader>
          <CardTitle>Pending products</CardTitle>
          <CardDescription>
            {filteredDrafts.length} draft{filteredDrafts.length === 1 ? "" : "s"}
            {auditMode ? " — approve and set Active/Inactive below" : " — start audit to enable actions"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg border border-dashed border-primary/30 bg-primary/5 px-4 py-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                All lines bill total (this device)
              </p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
                {formatCurrency(totalAuditBillCost)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {filteredDrafts.length} shown row{filteredDrafts.length === 1 ? "" : "s"} — compare with
                supplier bill amount.
              </p>
            </div>
            <div className="rounded-lg border border-dashed border-emerald-500/35 bg-emerald-500/5 px-4 py-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                OK marked (sequence matched)
              </p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
                {okMarkedCount}{" "}
                <span className="text-base font-normal text-muted-foreground">
                  / {filteredDrafts.length} item{filteredDrafts.length === 1 ? "" : "s"}
                </span>
              </p>
              <p className="mt-2 text-lg font-semibold tabular-nums text-emerald-800 dark:text-emerald-300">
                {formatCurrency(okMarkedBillTotal)}
                <span className="ml-2 text-xs font-normal text-muted-foreground">budget total</span>
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Sum of bill costs for rows ticked OK. Untick lines that do not match the bill order or
                amount.
              </p>
            </div>
          </div>

          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center">
            <div className="relative min-w-[200px] flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search name or barcode…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8"
              />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full sm:w-48">
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

          {filteredDrafts.length === 0 ? (
            <div className={inventoryTableFrameClassName()}>
              <Table>
                <TableBody>
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={13} className="h-40 text-center">
                      <div className="flex flex-col items-center justify-center gap-2 py-6">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                          <Inbox className="h-6 w-6 text-muted-foreground" />
                        </div>
                        <p className="font-medium text-foreground">No draft entries</p>
                        <p className="text-sm text-muted-foreground">
                          New products from Add product & batch appear here first.
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          ) : isMainAdmin && groupedByAccount ? (
            <div className="space-y-3">
              {groupedByAccount.map(([accountKey, rows]) => (
                <Collapsible key={accountKey} defaultOpen className="rounded-lg border">
                  <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left hover:bg-muted/40">
                    <span className="flex items-center gap-2 font-semibold">
                      <ChevronDown className="h-4 w-4 shrink-0" />
                      Account{" "}
                      <span className="font-mono text-primary">{accountKey}</span>
                    </span>
                    <Badge variant="secondary" className="tabular-nums">
                      {rows.length} draft{rows.length === 1 ? "" : "s"}
                    </Badge>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className={cn(inventoryTableFrameClassName(), "border-0 rounded-none")}>
                      <Table>
                        <TableHeader>
                          <TableRow className="border-b-0 hover:bg-transparent">
                            <TableHead className={cn(invTableHeadClass, "w-[72px] text-center")}>
                              OK
                            </TableHead>
                            <TableHead className={invTableHeadClass}>Product</TableHead>
                            <TableHead className={cn(invTableHeadClass, "hidden md:table-cell")}>
                              Category
                            </TableHead>
                            <TableHead className={cn(invTableHeadClass, "hidden md:table-cell")}>
                              Rack
                            </TableHead>
                            <TableHead className={cn(invTableHeadClass, "text-right")}>MRP</TableHead>
                            <TableHead className={cn(invTableHeadClass, "text-right")}>Sell</TableHead>
                            <TableHead
                              className={cn(invTableHeadClass, "text-right hidden lg:table-cell")}
                            >
                              GST
                            </TableHead>
                            <TableHead className={cn(invTableHeadClass, "text-right")}>Qty</TableHead>
                            <TableHead className={cn(invTableHeadClass, "text-right w-[120px]")}>
                              Unit cost
                            </TableHead>
                            <TableHead className={cn(invTableHeadClass, "text-right w-[120px]")}>
                              Bill total
                            </TableHead>
                            <TableHead className={cn(invTableHeadClass, "hidden sm:table-cell")}>
                              Added
                            </TableHead>
                            <TableHead className={cn(invTableHeadClass, "w-[140px]")}>Status</TableHead>
                            <TableHead
                              className={cn(invTableHeadClass, "min-w-[220px] text-right pr-4")}
                            >
                              Actions
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>{rows.map(renderDraftProductRow)}</TableBody>
                      </Table>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              ))}
            </div>
          ) : (
          <div className={inventoryTableFrameClassName()}>
            <Table>
              <TableHeader>
                <TableRow className="border-b-0 hover:bg-transparent">
                  <TableHead className={cn(invTableHeadClass, "w-[72px] text-center")}>OK</TableHead>
                  <TableHead className={invTableHeadClass}>Product</TableHead>
                  <TableHead className={cn(invTableHeadClass, "hidden md:table-cell")}>Category</TableHead>
                  <TableHead className={cn(invTableHeadClass, "hidden md:table-cell")}>Rack</TableHead>
                  <TableHead className={cn(invTableHeadClass, "text-right")}>MRP</TableHead>
                  <TableHead className={cn(invTableHeadClass, "text-right")}>Sell</TableHead>
                  <TableHead className={cn(invTableHeadClass, "text-right hidden lg:table-cell")}>
                    GST
                  </TableHead>
                  <TableHead className={cn(invTableHeadClass, "text-right")}>Qty</TableHead>
                  <TableHead className={cn(invTableHeadClass, "text-right w-[120px]")}>
                    Unit cost
                  </TableHead>
                  <TableHead className={cn(invTableHeadClass, "text-right w-[120px]")}>
                    Bill total
                  </TableHead>
                  <TableHead className={cn(invTableHeadClass, "hidden sm:table-cell")}>Added</TableHead>
                  <TableHead className={cn(invTableHeadClass, "w-[140px]")}>Status</TableHead>
                  <TableHead className={cn(invTableHeadClass, "min-w-[220px] text-right pr-4")}>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>{filteredDrafts.map(renderDraftProductRow)}</TableBody>
            </Table>
          </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!draftToDelete} onOpenChange={(open) => !open && setDraftToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete draft entry?</AlertDialogTitle>
            <AlertDialogDescription>
              {draftToDelete ? (
                <>
                  Remove <span className="font-medium text-foreground">{draftToDelete.name}</span>{" "}
                  from Draft Entries. This does not add it to inventory and cannot be undone.
                </>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={!!deletingId}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={!!deletingId}
              onClick={(e) => {
                e.preventDefault()
                void handleConfirmDelete()
              }}
            >
              {deletingId ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={auditDialogOpen} onOpenChange={setAuditDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Start audit</DialogTitle>
            <DialogDescription>
              Enter the audit password to enable Approve and status changes on draft rows.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="draft-audit-password">Password</Label>
            <Input
              id="draft-audit-password"
              type="password"
              autoComplete="off"
              value={auditPassword}
              onChange={(e) => setAuditPassword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") startAudit()
              }}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAuditDialogOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={startAudit}>
              Start audit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
