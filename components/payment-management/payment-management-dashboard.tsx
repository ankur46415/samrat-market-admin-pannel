"use client"

import { useMemo, useState } from "react"
import { format } from "date-fns"
import {
  ArrowLeft,
  Download,
  Loader2,
  Pencil,
  Plus,
  Search,
  Trash2,
  Wallet,
} from "lucide-react"
import { toast } from "sonner"
import { usePaymentManagement } from "@/hooks/use-payment-management"
import type { PaymentEntryType, PaymentPayee } from "@/lib/features/payment-management/models"
import {
  downloadPayeeStatementPdf,
  downloadPaymentOverviewPdf,
} from "@/lib/features/payment-management/pdf-export"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

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
  const d = new Date(`${value}T00:00:00`)
  return Number.isNaN(d.getTime()) ? null : d
}

function remainingLabel(remaining: number) {
  if (remaining > 0.009) return { text: "Due", className: "text-destructive" }
  if (remaining < -0.009) return { text: "Advance", className: "text-emerald-600" }
  return { text: "Settled", className: "text-emerald-600" }
}

export function PaymentManagementDashboard() {
  const {
    payees,
    entries,
    summaries,
    totals,
    loading,
    createPayee,
    editPayee,
    removePayee,
    addEntry,
    removeEntry,
  } = usePaymentManagement()

  const [search, setSearch] = useState("")
  const [selectedPayeeId, setSelectedPayeeId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [downloadingPdf, setDownloadingPdf] = useState(false)

  const [payeeDialogOpen, setPayeeDialogOpen] = useState(false)
  const [editingPayee, setEditingPayee] = useState<PaymentPayee | null>(null)
  const [payeeForm, setPayeeForm] = useState({ name: "", phone: "", notes: "" })

  const [entryDialogOpen, setEntryDialogOpen] = useState(false)
  const [entryType, setEntryType] = useState<PaymentEntryType>("purchase")
  const [entryForm, setEntryForm] = useState({
    amount: "",
    date: formatDateInput(new Date()),
    notes: "",
  })

  const [deletePayeeId, setDeletePayeeId] = useState<string | null>(null)
  const [deleteEntryId, setDeleteEntryId] = useState<string | null>(null)

  const filteredSummaries = useMemo(() => {
    const q = search.trim().toLowerCase()
    const rows = q
      ? summaries.filter((row) => {
          const hay = `${row.payee.name} ${row.payee.phone ?? ""} ${row.payee.notes ?? ""}`.toLowerCase()
          return hay.includes(q)
        })
      : summaries
    return [...rows].sort((a, b) => b.remaining - a.remaining || a.payee.name.localeCompare(b.payee.name))
  }, [search, summaries])

  const selectedPayee = payees.find((p) => p.id === selectedPayeeId) ?? null
  const selectedSummary = summaries.find((s) => s.payee.id === selectedPayeeId)
  const selectedEntries = useMemo(
    () => entries.filter((e) => e.payeeId === selectedPayeeId),
    [entries, selectedPayeeId]
  )

  const openCreatePayee = () => {
    setEditingPayee(null)
    setPayeeForm({ name: "", phone: "", notes: "" })
    setPayeeDialogOpen(true)
  }

  const openEditPayee = (payee: PaymentPayee) => {
    setEditingPayee(payee)
    setPayeeForm({
      name: payee.name,
      phone: payee.phone ?? "",
      notes: payee.notes ?? "",
    })
    setPayeeDialogOpen(true)
  }

  const savePayee = async () => {
    const name = payeeForm.name.trim()
    if (!name) {
      toast.error("Enter supplier / payee name")
      return
    }
    setSaving(true)
    try {
      if (editingPayee) {
        await editPayee(editingPayee.id, {
          name,
          phone: payeeForm.phone,
          notes: payeeForm.notes,
        })
        toast.success("Payee updated")
      } else {
        const id = await createPayee({
          name,
          phone: payeeForm.phone,
          notes: payeeForm.notes,
        })
        setSelectedPayeeId(id)
        toast.success("Payee added")
      }
      setPayeeDialogOpen(false)
    } catch (error) {
      console.error(error)
      toast.error("Could not save payee")
    } finally {
      setSaving(false)
    }
  }

  const confirmDeletePayee = async () => {
    if (!deletePayeeId) return
    setSaving(true)
    try {
      await removePayee(deletePayeeId)
      if (selectedPayeeId === deletePayeeId) setSelectedPayeeId(null)
      toast.success("Payee and ledger deleted")
      setDeletePayeeId(null)
    } catch (error) {
      console.error(error)
      toast.error("Could not delete payee")
    } finally {
      setSaving(false)
    }
  }

  const openEntryDialog = (type: PaymentEntryType) => {
    setEntryType(type)
    setEntryForm({ amount: "", date: formatDateInput(new Date()), notes: "" })
    setEntryDialogOpen(true)
  }

  const saveEntry = async () => {
    if (!selectedPayeeId) return
    const amount = Number(entryForm.amount)
    const date = parseDateInput(entryForm.date)
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Enter a valid amount")
      return
    }
    if (!date) {
      toast.error("Choose a date")
      return
    }
    setSaving(true)
    try {
      await addEntry({
        payeeId: selectedPayeeId,
        type: entryType,
        amount,
        date,
        notes: entryForm.notes,
      })
      toast.success(entryType === "purchase" ? "Purchase added" : "Payment recorded")
      setEntryDialogOpen(false)
    } catch (error) {
      console.error(error)
      toast.error("Could not save entry")
    } finally {
      setSaving(false)
    }
  }

  const handleDownloadPayeePdf = async () => {
    if (!selectedPayee) return
    setDownloadingPdf(true)
    try {
      await downloadPayeeStatementPdf(selectedPayee, selectedEntries)
      toast.success("PDF downloaded")
    } catch (error) {
      console.error(error)
      toast.error("Could not generate PDF")
    } finally {
      setDownloadingPdf(false)
    }
  }

  const handleDownloadOverviewPdf = async () => {
    setDownloadingPdf(true)
    try {
      await downloadPaymentOverviewPdf(summaries, totals)
      toast.success("PDF downloaded")
    } catch (error) {
      console.error(error)
      toast.error("Could not generate PDF")
    } finally {
      setDownloadingPdf(false)
    }
  }

  const confirmDeleteEntry = async () => {
    if (!deleteEntryId) return
    setSaving(true)
    try {
      await removeEntry(deleteEntryId)
      toast.success("Entry deleted")
      setDeleteEntryId(null)
    } catch (error) {
      console.error(error)
      toast.error("Could not delete entry")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-80" />
        <div className="grid gap-4 sm:grid-cols-3">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
        <Skeleton className="h-[420px]" />
      </div>
    )
  }

  if (selectedPayee && selectedSummary) {
    const due = remainingLabel(selectedSummary.remaining)
    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <Button variant="ghost" size="sm" className="-ml-2 mb-2" onClick={() => setSelectedPayeeId(null)}>
              <ArrowLeft className="mr-1 h-4 w-4" />
              All payees
            </Button>
            <h1 className="text-2xl font-semibold tracking-tight">{selectedPayee.name}</h1>
            <p className="text-muted-foreground">
              {selectedPayee.phone || "No phone"}
              {selectedPayee.notes ? ` · ${selectedPayee.notes}` : ""}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={handleDownloadPayeePdf} disabled={downloadingPdf}>
              {downloadingPdf ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
              Download PDF
            </Button>
            <Button variant="outline" onClick={() => openEditPayee(selectedPayee)}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </Button>
            <Button variant="outline" onClick={() => openEntryDialog("purchase")}>
              <Plus className="mr-2 h-4 w-4" />
              Add purchase
            </Button>
            <Button onClick={() => openEntryDialog("payment")}>
              <Plus className="mr-2 h-4 w-4" />
              Add payment
            </Button>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Purchases</CardDescription>
              <CardTitle className="text-2xl tabular-nums">{formatCurrency(selectedSummary.purchases)}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Paid</CardDescription>
              <CardTitle className="text-2xl tabular-nums">{formatCurrency(selectedSummary.paid)}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Remaining</CardDescription>
              <CardTitle className={cn("text-2xl tabular-nums", due.className)}>
                {formatCurrency(Math.abs(selectedSummary.remaining))}
              </CardTitle>
              <p className={cn("text-sm font-medium", due.className)}>{due.text}</p>
            </CardHeader>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Ledger</CardTitle>
            <CardDescription>Purchases increase the amount due. Payments reduce it. Partial payments are recorded as separate payment entries.</CardDescription>
          </CardHeader>
          <CardContent>
            {selectedEntries.length === 0 ? (
              <p className="py-10 text-center text-muted-foreground">
                No purchases or payments yet. Add a purchase for an order, then record payments as you pay.
              </p>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Notes</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead className="w-12" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedEntries.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell className="whitespace-nowrap">{format(entry.date, "dd MMM yyyy")}</TableCell>
                        <TableCell>
                          <Badge variant={entry.type === "purchase" ? "secondary" : "default"}>
                            {entry.type === "purchase" ? "Purchase" : "Payment"}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-[280px] truncate text-muted-foreground">
                          {entry.notes || "—"}
                        </TableCell>
                        <TableCell
                          className={cn(
                            "text-right font-semibold tabular-nums",
                            entry.type === "purchase" ? "text-destructive" : "text-emerald-600"
                          )}
                        >
                          {entry.type === "purchase" ? "+" : "−"}
                          {formatCurrency(entry.amount)}
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" onClick={() => setDeleteEntryId(entry.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <PayeeDialog
          open={payeeDialogOpen}
          onOpenChange={setPayeeDialogOpen}
          title={editingPayee ? "Edit payee" : "Add supplier / payee"}
          form={payeeForm}
          setForm={setPayeeForm}
          saving={saving}
          onSave={savePayee}
        />
        <EntryDialog
          open={entryDialogOpen}
          onOpenChange={setEntryDialogOpen}
          type={entryType}
          payeeName={selectedPayee.name}
          remaining={selectedSummary.remaining}
          form={entryForm}
          setForm={setEntryForm}
          saving={saving}
          onSave={saveEntry}
        />
        <AlertDialog open={!!deleteEntryId} onOpenChange={(open) => !open && setDeleteEntryId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this entry?</AlertDialogTitle>
              <AlertDialogDescription>Remaining amount will update immediately.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={confirmDeleteEntry} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <Wallet className="h-6 w-6 text-primary" />
            Payment Management
          </h1>
          <p className="text-muted-foreground">
            Track supplier purchases and partial payments. Remaining = purchases − payments.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={handleDownloadOverviewPdf} disabled={downloadingPdf || summaries.length === 0}>
            {downloadingPdf ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
            Download PDF
          </Button>
          <Button onClick={openCreatePayee}>
            <Plus className="mr-2 h-4 w-4" />
            Add supplier / payee
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total purchases</CardDescription>
            <CardTitle className="text-2xl tabular-nums">{formatCurrency(totals.purchases)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total paid</CardDescription>
            <CardTitle className="text-2xl tabular-nums">{formatCurrency(totals.paid)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total remaining due</CardDescription>
            <CardTitle className={cn("text-2xl tabular-nums", totals.remaining > 0 ? "text-destructive" : "text-emerald-600")}>
              {formatCurrency(totals.remaining)}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader className="gap-4 space-y-0 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Suppliers & payees</CardTitle>
            <CardDescription>Open a payee to add purchases and payments against that account.</CardDescription>
          </div>
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search payees..."
              className="pl-8"
            />
          </div>
        </CardHeader>
        <CardContent>
          {filteredSummaries.length === 0 ? (
            <div className="py-12 text-center">
              <p className="font-medium">No payees yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Add a supplier, then record the purchase amount and pay in parts as you go.
              </p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Payee</TableHead>
                    <TableHead className="text-right">Purchases</TableHead>
                    <TableHead className="text-right">Paid</TableHead>
                    <TableHead className="text-right">Remaining</TableHead>
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSummaries.map((row) => {
                    const due = remainingLabel(row.remaining)
                    return (
                      <TableRow
                        key={row.payee.id}
                        className="cursor-pointer"
                        onClick={() => setSelectedPayeeId(row.payee.id)}
                      >
                        <TableCell>
                          <div className="font-medium">{row.payee.name}</div>
                          <div className="text-xs text-muted-foreground">{row.payee.phone || "No phone"}</div>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{formatCurrency(row.purchases)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatCurrency(row.paid)}</TableCell>
                        <TableCell className="text-right">
                          <div className={cn("font-semibold tabular-nums", due.className)}>
                            {formatCurrency(Math.abs(row.remaining))}
                          </div>
                          <div className={cn("text-xs", due.className)}>{due.text}</div>
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeletePayeeId(row.payee.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <PayeeDialog
        open={payeeDialogOpen}
        onOpenChange={setPayeeDialogOpen}
        title={editingPayee ? "Edit payee" : "Add supplier / payee"}
        form={payeeForm}
        setForm={setPayeeForm}
        saving={saving}
        onSave={savePayee}
      />
      <AlertDialog open={!!deletePayeeId} onOpenChange={(open) => !open && setDeletePayeeId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this payee?</AlertDialogTitle>
            <AlertDialogDescription>
              All purchases and payments for this payee will be removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeletePayee} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function PayeeDialog({
  open,
  onOpenChange,
  title,
  form,
  setForm,
  saving,
  onSave,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  form: { name: string; phone: string; notes: string }
  setForm: (form: { name: string; phone: string; notes: string }) => void
  saving: boolean
  onSave: () => Promise<void>
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="payee-name">Name *</Label>
            <Input
              id="payee-name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Supplier or payee name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="payee-phone">Phone</Label>
            <Input
              id="payee-phone"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="Optional"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="payee-notes">Notes</Label>
            <Textarea
              id="payee-notes"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Optional"
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onSave} disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function EntryDialog({
  open,
  onOpenChange,
  type,
  payeeName,
  remaining,
  form,
  setForm,
  saving,
  onSave,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  type: PaymentEntryType
  payeeName: string
  remaining: number
  form: { amount: string; date: string; notes: string }
  setForm: (form: { amount: string; date: string; notes: string }) => void
  saving: boolean
  onSave: () => Promise<void>
}) {
  const isPurchase = type === "purchase"
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isPurchase ? "Add purchase" : "Add payment"}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          {payeeName} · current remaining {formatCurrency(remaining)}
        </p>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="entry-amount">Amount (₹) *</Label>
            <Input
              id="entry-amount"
              type="number"
              min="0"
              step="0.01"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              placeholder="0.00"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="entry-date">Date *</Label>
            <Input
              id="entry-date"
              type="date"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="entry-notes">{isPurchase ? "Order / notes" : "Notes"}</Label>
            <Textarea
              id="entry-notes"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder={isPurchase ? "Invoice no., order tag, or items" : "UPI, cash, cheque no."}
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onSave} disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {isPurchase ? "Save purchase" : "Save payment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
