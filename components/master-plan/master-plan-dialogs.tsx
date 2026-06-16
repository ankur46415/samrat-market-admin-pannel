"use client"

import { useEffect, useState } from "react"
import {
  MASTER_PLAN_CATEGORIES,
  type MasterPlanCategoryId,
  masterPlanCategoryName,
} from "@/lib/features/master-plan/constants"
import type { MasterPlanItem, MasterPlanItemInput } from "@/lib/features/master-plan/models"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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

type ItemDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  item: MasterPlanItem | null
  onSave: (input: MasterPlanItemInput) => Promise<void>
}

const emptyForm: MasterPlanItemInput = {
  category: "Groceries",
  name: "",
  brand: "",
  size: "",
  whls: 0,
  mrp: 0,
  qty: 0,
}

function itemToForm(item: MasterPlanItem): MasterPlanItemInput {
  return {
    category: item.category,
    name: item.name,
    brand: item.brand,
    size: item.size,
    whls: item.whls,
    mrp: item.mrp,
    qty: item.qty,
  }
}

export function MasterPlanItemDialog({ open, onOpenChange, item, onSave }: ItemDialogProps) {
  const [form, setForm] = useState<MasterPlanItemInput>(emptyForm)
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setForm(item ? itemToForm(item) : emptyForm)
    setError("")
  }, [open, item])

  const handleOpenChange = (next: boolean) => {
    onOpenChange(next)
  }

  const handleSave = async () => {
    if (!form.name.trim()) {
      setError("Please enter a valid Product Name.")
      return
    }
    setSaving(true)
    try {
      await onSave({
        ...form,
        name: form.name.trim(),
        brand: form.brand.trim(),
        size: form.size.trim(),
      })
      onOpenChange(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{item ? "Edit item" : "Add new item"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {error ? (
            <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              <span className="font-semibold">Error:</span>
              <span>{error}</span>
            </div>
          ) : null}

          <div>
            <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Category
            </Label>
            <Select
              value={form.category}
              onValueChange={(v) => setForm((f) => ({ ...f, category: v as MasterPlanCategoryId }))}
            >
              <SelectTrigger className="mt-1.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MASTER_PLAN_CATEGORIES.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Product Name
            </Label>
            <Input
              className="mt-1.5"
              placeholder="e.g. Premium Basmati Rice"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Top Brands
              </Label>
              <Input
                className="mt-1.5"
                placeholder="e.g. India Gate"
                value={form.brand}
                onChange={(e) => setForm((f) => ({ ...f, brand: e.target.value }))}
              />
            </div>
            <div>
              <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Pack Size / Spec
              </Label>
              <Input
                className="mt-1.5"
                placeholder="e.g. 1 Kg, 500g"
                value={form.size}
                onChange={(e) => setForm((f) => ({ ...f, size: e.target.value }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Wholesale (₹)
              </Label>
              <Input
                type="number"
                step="0.01"
                className="mt-1.5"
                value={form.whls}
                onChange={(e) => setForm((f) => ({ ...f, whls: parseFloat(e.target.value) || 0 }))}
              />
            </div>
            <div>
              <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                MRP (₹)
              </Label>
              <Input
                type="number"
                step="0.01"
                className="mt-1.5"
                value={form.mrp}
                onChange={(e) => setForm((f) => ({ ...f, mrp: parseFloat(e.target.value) || 0 }))}
              />
            </div>
            <div>
              <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Quantity
              </Label>
              <Input
                type="number"
                className="mt-1.5"
                value={form.qty}
                onChange={(e) => setForm((f) => ({ ...f, qty: parseInt(e.target.value, 10) || 0 }))}
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            Save item
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

type DeleteDialogProps = {
  item: MasterPlanItem | null
  onOpenChange: (open: boolean) => void
  onConfirm: () => Promise<void>
}

export function MasterPlanDeleteDialog({ item, onOpenChange, onConfirm }: DeleteDialogProps) {
  const [deleting, setDeleting] = useState(false)

  return (
    <AlertDialog open={!!item} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-destructive">
            Remove item?
          </AlertDialogTitle>
          <AlertDialogDescription>
            Delete &quot;{item?.name}&quot; from the master plan? This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-red-600 hover:bg-red-700"
            disabled={deleting}
            onClick={async (e) => {
              e.preventDefault()
              setDeleting(true)
              try {
                await onConfirm()
                onOpenChange(false)
              } finally {
                setDeleting(false)
              }
            }}
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

export function itemMargin(mrp: number, whls: number): number {
  return mrp > 0 ? ((mrp - whls) / mrp) * 100 : 0
}

export function formatInr(amount: number, decimals = 0): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: decimals,
    minimumFractionDigits: decimals,
  }).format(amount)
}

export { masterPlanCategoryName }
