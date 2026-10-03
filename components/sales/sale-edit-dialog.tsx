"use client"

import { useEffect, useMemo, useState } from "react"
import { Loader2, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useProducts } from "@/hooks/use-firestore"
import type { Sale, SaleItem } from "@/lib/types"
import { saveEditedSale, deleteSale, totalsFromItems } from "@/lib/features/sales/update-sale"

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount)
}

function cloneItems(items: SaleItem[]): SaleItem[] {
  return items.map((item) => ({ ...item }))
}

export function SaleEditDialog({
  open,
  onOpenChange,
  sale,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  sale: Sale | null
}) {
  const { products } = useProducts()
  const [items, setItems] = useState<SaleItem[]>([])
  const [reason, setReason] = useState("")
  const [search, setSearch] = useState("")
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    if (!open || !sale) return
    setItems(cloneItems(sale.items))
    setReason("")
    setSearch("")
    setConfirmDelete(false)
  }, [open, sale])

  const preview = useMemo(() => totalsFromItems(items), [items])

  const matches = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (q.length < 1) return []
    return products
      .filter((p) => {
        const hay = `${p.name} ${p.barcode ?? ""} ${p.brand ?? ""}`.toLowerCase()
        return hay.includes(q)
      })
      .slice(0, 8)
  }, [products, search])

  if (!sale) return null

  const updateItem = (index: number, patch: Partial<SaleItem>) => {
    setItems((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item
        const next = { ...item, ...patch }
        const quantity = Math.max(0, Math.floor(Number(next.quantity) || 0))
        const price = Math.max(0, Number(next.price) || 0)
        return { ...next, quantity, price, total: quantity * price }
      })
    )
  }

  const removeItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index))
  }

  const addProduct = (productId: string, name: string, price: number, barcode?: string, mrp?: number) => {
    setItems((prev) => [
      ...prev,
      {
        productId: barcode || productId,
        productName: name,
        quantity: 1,
        price,
        total: price,
        ...(mrp && mrp > 0 ? { mrp } : {}),
      },
    ])
    setSearch("")
  }

  const addManual = () => {
    setItems((prev) => [
      ...prev,
      {
        productId: `OTHER-${Date.now().toString(36).toUpperCase()}`,
        productName: "Return / other item",
        quantity: 1,
        price: 0,
        total: 0,
      },
    ])
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await saveEditedSale({ sale, items, reason })
      toast.success("Bill updated. Stock adjusted for returns / replacements.")
      onOpenChange(false)
    } catch (error) {
      console.error(error)
      toast.error(error instanceof Error ? error.message : "Failed to update bill")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await deleteSale(sale)
      toast.success(`Bill ${sale.billNo} deleted. Stock restored.`)
      setConfirmDelete(false)
      onOpenChange(false)
    } catch (error) {
      console.error(error)
      toast.error(error instanceof Error ? error.message : "Failed to delete bill")
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col overflow-hidden sm:max-w-3xl">
        <DialogHeader className="shrink-0">
          <DialogTitle>Edit bill {sale.billNo}</DialogTitle>
          <DialogDescription>
            Change, add, or remove items for return / replace. Stock is updated when you save.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
          <div className="space-y-2">
            <Label>Add product from inventory</Label>
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name or barcode…"
            />
            {matches.length > 0 ? (
              <div className="rounded-md border">
                {matches.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-muted"
                    onClick={() => addProduct(p.id, p.name, p.price, p.barcode, p.mrp)}
                  >
                    <span>
                      <span className="font-medium">{p.name}</span>
                      <span className="ml-2 font-mono text-xs text-muted-foreground">{p.barcode}</span>
                    </span>
                    <span className="tabular-nums">{formatCurrency(p.price)}</span>
                  </button>
                ))}
              </div>
            ) : null}
            <Button type="button" variant="outline" size="sm" className="gap-1" onClick={addManual}>
              <Plus className="h-4 w-4" />
              Add other / return line
            </Button>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead className="w-24">Qty</TableHead>
                  <TableHead className="w-28 text-right">Price</TableHead>
                  <TableHead className="w-28 text-right">Total</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-16 text-center text-muted-foreground">
                      No items. Add a product or an other line.
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((item, index) => (
                    <TableRow key={`${item.productId}-${index}`}>
                      <TableCell>
                        <Input
                          value={item.productName}
                          onChange={(e) => updateItem(index, { productName: e.target.value })}
                        />
                        {item.productId ? (
                          <p className="mt-1 font-mono text-[11px] text-muted-foreground">{item.productId}</p>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min={0}
                          value={item.quantity}
                          onChange={(e) => updateItem(index, { quantity: Number(e.target.value) })}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          className="text-right"
                          value={item.price}
                          onChange={(e) => updateItem(index, { price: Number(e.target.value) })}
                        />
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{formatCurrency(item.total)}</TableCell>
                      <TableCell>
                        <Button type="button" variant="ghost" size="icon" onClick={() => removeItem(index)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex justify-end text-sm">
            <div className="w-56 space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Previous total</span>
                <span>{formatCurrency(sale.total)}</span>
              </div>
              <div className="flex justify-between font-semibold">
                <span>New total</span>
                <span>{formatCurrency(preview.total)}</span>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-reason">Reason (return / replace)</Label>
            <Textarea
              id="edit-reason"
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Customer returned 1 oil, replaced with same product"
            />
          </div>
        </div>

        <DialogFooter className="shrink-0 sm:justify-between">
          <Button
            type="button"
            variant="destructive"
            onClick={() => setConfirmDelete(true)}
            disabled={saving || deleting}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete transaction
          </Button>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void handleSave()} disabled={saving || deleting}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save bill
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete bill {sale.billNo}?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the sale from Sales History and Today’s Sales. Item quantities are returned to stock. This
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleting}
              onClick={(e) => {
                e.preventDefault()
                void handleDelete()
              }}
            >
              {deleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Delete transaction
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  )
}
