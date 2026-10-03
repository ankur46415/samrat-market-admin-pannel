"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { format } from "date-fns"
import { Box, FilePenLine, Inbox, Pencil, Search, ShieldCheck } from "lucide-react"
import { toast } from "sonner"
import { TEST_ACCOUNT_PASSKEY } from "@/lib/account-mode"
import { useDraftProducts } from "@/hooks/use-firestore"
import { Button } from "@/components/ui/button"
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

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount)
}

export default function DraftEntriesPage() {
  const { drafts, loading, updateDraftStatus, approveDraft } = useDraftProducts()
  const [search, setSearch] = useState("")
  const [categoryFilter, setCategoryFilter] = useState<string>("all")
  const [auditMode, setAuditMode] = useState(false)
  const [auditDialogOpen, setAuditDialogOpen] = useState(false)
  const [auditPassword, setAuditPassword] = useState("")
  const [approvingId, setApprovingId] = useState<string | null>(null)
  const [statusSavingId, setStatusSavingId] = useState<string | null>(null)

  const categories = useMemo(() => {
    const cats = [...new Set(drafts.map((p) => p.category))]
    return cats.filter(Boolean).sort()
  }, [drafts])

  const filteredDrafts = useMemo(() => {
    const q = search.trim()
    const qLower = q.toLowerCase()
    return drafts.filter((product) => {
      const matchesSearch =
        !q ||
        product.name.toLowerCase().includes(qLower) ||
        (product.barcode != null &&
          (barcodesMatch(product.barcode, q) || product.barcode.toLowerCase().includes(qLower)))
      const matchesCategory = categoryFilter === "all" || product.category === categoryFilter
      return matchesSearch && matchesCategory
    })
  }, [drafts, search, categoryFilter])

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
      await approveDraft(product.id)
      toast.success(`${product.name} approved and moved to All Products`)
    } catch (error) {
      console.error(error)
      toast.error(error instanceof Error ? error.message : "Failed to approve")
    } finally {
      setApprovingId(null)
    }
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
            New items stay here until you audit and approve them into Inventory → All Products.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {auditMode ? (
            <Button type="button" variant="outline" onClick={endAudit}>
              End audit
            </Button>
          ) : (
            <Button type="button" className="gap-2" onClick={() => setAuditDialogOpen(true)}>
              <ShieldCheck className="h-4 w-4" />
              Start audit
            </Button>
          )}
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

          <div className={inventoryTableFrameClassName()}>
            <Table>
              <TableHeader>
                <TableRow className="border-b-0 hover:bg-transparent">
                  <TableHead className={invTableHeadClass}>Product</TableHead>
                  <TableHead className={cn(invTableHeadClass, "hidden md:table-cell")}>Category</TableHead>
                  <TableHead className={cn(invTableHeadClass, "hidden md:table-cell")}>Rack</TableHead>
                  <TableHead className={cn(invTableHeadClass, "text-right")}>MRP</TableHead>
                  <TableHead className={cn(invTableHeadClass, "text-right")}>Sell</TableHead>
                  <TableHead className={cn(invTableHeadClass, "text-right")}>Qty</TableHead>
                  <TableHead className={cn(invTableHeadClass, "hidden sm:table-cell")}>Added</TableHead>
                  <TableHead className={cn(invTableHeadClass, "w-[140px]")}>Status</TableHead>
                  <TableHead className={cn(invTableHeadClass, "w-[168px] text-right pr-4")}>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDrafts.length === 0 ? (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={9} className="h-40 text-center">
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
                ) : (
                  filteredDrafts.map((product) => {
                    const rowStatus =
                      product.status && STATUS_OPTIONS.includes(product.status as (typeof STATUS_OPTIONS)[number])
                        ? product.status
                        : "deactive"
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
                        <TableCell className={invTableCellNumeric}>
                          {product.mrp != null && product.mrp > 0 ? formatCurrency(product.mrp) : "—"}
                        </TableCell>
                        <TableCell className={invTableCellNumeric}>{formatCurrency(product.price)}</TableCell>
                        <TableCell className={invTableCellNumeric}>
                          <span className="font-semibold">{product.stock}</span>
                          <span className="ml-1 text-muted-foreground">{product.unit}</span>
                        </TableCell>
                        <TableCell className={cn(invTableCellClass, "hidden sm:table-cell text-muted-foreground")}>
                          {format(product.createdAt, "MMM dd, yyyy")}
                        </TableCell>
                        <TableCell className={invTableCellClass}>
                          <Select
                            value={rowStatus}
                            disabled={!auditMode || statusSavingId === product.id}
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
                          <div className="flex justify-end gap-2">
                            <Button type="button" size="sm" variant="outline" asChild>
                              <Link href={`/draft-entries/edit/${product.id}`}>
                                <Pencil className="mr-1 h-3.5 w-3.5" />
                                Edit
                              </Link>
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              disabled={!auditMode || approvingId === product.id}
                              onClick={() => void handleApprove(product)}
                            >
                              {approvingId === product.id ? "…" : "Approve"}
                            </Button>
                          </div>
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
