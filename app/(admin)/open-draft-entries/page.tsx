"use client"

import { useMemo, useState } from "react"
import { format } from "date-fns"
import { Inbox, Search, ShieldCheck, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { TEST_ACCOUNT_PASSKEY } from "@/lib/account-mode"
import { useOpenDraftEntries } from "@/hooks/use-firestore"
import { useSessionUser } from "@/lib/auth-session"
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { barcodesMatch } from "@/lib/stock"
import {
  inventoryTableFrameClassName,
  invTableCellClass,
  invTableHeadClass,
} from "@/lib/inventory-ui"
import { cn } from "@/lib/utils"
import type { OpenDraftEntry } from "@/lib/types"
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

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount)
}

export default function OpenDraftEntriesPage() {
  const { user } = useSessionUser()
  const isScanner = user?.role === "scanner"
  const { entries, loading, approveEntry, deleteEntry } = useOpenDraftEntries()
  const [search, setSearch] = useState("")
  const [auditMode, setAuditMode] = useState(false)
  const [auditDialogOpen, setAuditDialogOpen] = useState(false)
  const [auditPassword, setAuditPassword] = useState("")
  const [approvingId, setApprovingId] = useState<string | null>(null)
  const [entryToDelete, setEntryToDelete] = useState<OpenDraftEntry | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const q = search.trim()
    const qLower = q.toLowerCase()
    return entries.filter((row) => {
      if (isScanner && user?.accountTag && row.editedBy !== user.accountTag) {
        return false
      }
      if (!q) return true
      return (
        row.name.toLowerCase().includes(qLower) ||
        row.productId.toLowerCase().includes(qLower) ||
        row.tag.toLowerCase().includes(qLower) ||
        row.editedBy.toLowerCase().includes(qLower) ||
        (row.barcode != null &&
          (barcodesMatch(row.barcode, q) || row.barcode.toLowerCase().includes(qLower)))
      )
    })
  }, [entries, search, isScanner, user?.accountTag])

  const startAudit = () => {
    if (auditPassword.trim() !== TEST_ACCOUNT_PASSKEY) {
      toast.error("Wrong password")
      return
    }
    setAuditMode(true)
    setAuditDialogOpen(false)
    setAuditPassword("")
    toast.success("Review mode enabled — you can approve entries")
  }

  const endAudit = () => {
    setAuditMode(false)
    toast.message("Review mode ended")
  }

  const handleApprove = async (id: string, name: string) => {
    if (!auditMode) return
    setApprovingId(id)
    try {
      await approveEntry(id)
      toast.success(`${name} approved — live product updated`)
    } catch (error) {
      console.error(error)
      toast.error(error instanceof Error ? error.message : "Approve failed")
    } finally {
      setApprovingId(null)
    }
  }

  const canDeleteEntry = (row: OpenDraftEntry) => {
    if (isScanner) {
      return !user?.accountTag || row.editedBy === user.accountTag
    }
    return auditMode
  }

  const handleConfirmDelete = async () => {
    if (!entryToDelete || !canDeleteEntry(entryToDelete)) return
    setDeletingId(entryToDelete.id)
    try {
      await deleteEntry(entryToDelete.id)
      toast.success(`Removed pending edit for "${entryToDelete.name}"`)
      setEntryToDelete(null)
    } catch (error) {
      console.error(error)
      toast.error(error instanceof Error ? error.message : "Delete failed")
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Inbox className="h-7 w-7 text-primary" />
            Open Draft Entries
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isScanner
              ? "Your submitted edits waiting for admin approval."
              : "Review Scan & Edit changes. Tag shows which account submitted the edit."}
          </p>
        </div>
        {!isScanner && (
          <div className="flex flex-wrap gap-2">
            {auditMode ? (
              <Button variant="outline" size="sm" onClick={endAudit}>
                End review mode
              </Button>
            ) : (
              <Button size="sm" className="gap-2" onClick={() => setAuditDialogOpen(true)}>
                <ShieldCheck className="h-4 w-4" />
                Start review
              </Button>
            )}
          </div>
        )}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Queue</CardTitle>
          <CardDescription>{filtered.length} entr{filtered.length === 1 ? "y" : "ies"}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search name, barcode, tag, editor…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className={inventoryTableFrameClassName()}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className={invTableHeadClass}>Product</TableHead>
                  <TableHead className={invTableHeadClass}>Barcode</TableHead>
                  <TableHead className={invTableHeadClass}>Tag / Editor</TableHead>
                  <TableHead className={invTableHeadClass}>Brand</TableHead>
                  <TableHead className={invTableHeadClass}>Rack</TableHead>
                  <TableHead className={invTableHeadClass}>MRP</TableHead>
                  <TableHead className={invTableHeadClass}>Updated</TableHead>
                  <TableHead className={invTableHeadClass}>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading &&
                  Array.from({ length: 4 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={8}>
                        <Skeleton className="h-8 w-full" />
                      </TableCell>
                    </TableRow>
                  ))}
                {!loading && filtered.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className={cn(invTableCellClass, "text-center text-muted-foreground py-10")}
                    >
                      No open draft entries
                    </TableCell>
                  </TableRow>
                )}
                {!loading &&
                  filtered.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className={invTableCellClass}>
                        <div className="font-medium">{row.name}</div>
                        <div className="text-xs text-muted-foreground">{row.category}</div>
                      </TableCell>
                      <TableCell className={cn(invTableCellClass, "font-mono text-xs")}>
                        {row.barcode || "—"}
                      </TableCell>
                      <TableCell className={invTableCellClass}>
                        <span className="font-mono text-xs font-semibold">{row.tag || row.editedBy}</span>
                      </TableCell>
                      <TableCell className={invTableCellClass}>{row.brand || "—"}</TableCell>
                      <TableCell className={invTableCellClass}>{row.rack || "—"}</TableCell>
                      <TableCell className={invTableCellClass}>
                        {row.mrp != null && row.mrp > 0 ? formatCurrency(row.mrp) : "—"}
                      </TableCell>
                      <TableCell className={cn(invTableCellClass, "text-xs text-muted-foreground")}>
                        {format(row.updatedAt, "dd MMM yyyy, HH:mm")}
                      </TableCell>
                      <TableCell className={invTableCellClass}>
                        <div className="flex flex-wrap gap-2">
                          {!isScanner && (
                            <Button
                              size="sm"
                              disabled={!auditMode || approvingId === row.id}
                              onClick={() => void handleApprove(row.id, row.name)}
                            >
                              {approvingId === row.id ? "Approving…" : "Approve"}
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-destructive hover:text-destructive"
                            disabled={!canDeleteEntry(row) || deletingId === row.id}
                            onClick={() => setEntryToDelete(row)}
                          >
                            <Trash2 className="mr-1 h-3.5 w-3.5" />
                            Delete
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={!!entryToDelete} onOpenChange={(open) => !open && setEntryToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete pending edit?</AlertDialogTitle>
            <AlertDialogDescription>
              {entryToDelete ? (
                <>
                  Discard the proposed changes for{" "}
                  <span className="font-medium text-foreground">{entryToDelete.name}</span>. The live
                  product stays unchanged.
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Start review mode</DialogTitle>
            <DialogDescription>
              Enter the test account passkey to approve open draft entries (same as Draft Entries
              audit).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="audit-pass">Passkey</Label>
            <Input
              id="audit-pass"
              type="password"
              value={auditPassword}
              onChange={(e) => setAuditPassword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") startAudit()
              }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAuditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={startAudit}>Enable review</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
