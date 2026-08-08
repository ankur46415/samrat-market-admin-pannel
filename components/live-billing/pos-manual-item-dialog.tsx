"use client"

import { useState } from "react"
import { Loader2, PackagePlus } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { addManualItemToSession } from "@/lib/features/live_billing_admin/services/live_billing_admin_service"
import { PRESET_LINE_DISCOUNTS, parseDiscountInput } from "@/lib/billing/line-discount"

const EMPTY_FORM = {
  name: "",
  quantity: "1",
  price: "",
  discount: "0",
  customDiscount: "",
}

export function PosManualItemDialog({
  sessionId,
  disabled,
  onAdded,
}: {
  sessionId: string | null
  disabled?: boolean
  onAdded?: () => void
}) {
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)

  const reset = () => setForm(EMPTY_FORM)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!sessionId) {
      toast.error("POS session not ready")
      return
    }

    const name = form.name.trim()
    const quantity = Number(form.quantity)
    const price = Number(form.price)
    let discountPercent = Number(form.discount)

    if (!name) {
      toast.error("Enter product name")
      return
    }
    if (!Number.isFinite(quantity) || quantity < 1) {
      toast.error("Enter valid quantity")
      return
    }
    if (!Number.isFinite(price) || price < 0) {
      toast.error("Enter valid price")
      return
    }

    if (form.discount === "custom") {
      const parsed = parseDiscountInput(form.customDiscount)
      if (parsed == null) {
        toast.error("Enter valid discount %")
        return
      }
      discountPercent = parsed
    }

    setSaving(true)
    try {
      const item = await addManualItemToSession(sessionId, {
        name,
        quantity,
        price,
        discountPercent,
      })
      toast.success(`${item.name} added to bill`)
      setOpen(false)
      reset()
      onAdded?.()
    } catch (err) {
      console.error(err)
      toast.error(err instanceof Error ? err.message : "Failed to add item")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) reset()
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" variant="outline" disabled={disabled} className="shrink-0 gap-2">
          <PackagePlus className="h-4 w-4" />
          Add Other
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add other product</DialogTitle>
          <DialogDescription>
            Manual entry for items not in inventory — fill name, qty, rate and discount.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="manual-name">Product name *</Label>
            <Input
              id="manual-name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Carry bag, Misc item"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="manual-qty">Quantity *</Label>
              <Input
                id="manual-qty"
                type="number"
                min={1}
                step={1}
                value={form.quantity}
                onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="manual-price">Rate (INR) *</Label>
              <Input
                id="manual-price"
                type="number"
                min={0}
                step={1}
                value={form.price}
                onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                placeholder="0"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Discount</Label>
            <Select
              value={form.discount}
              onValueChange={(value) => setForm((f) => ({ ...f, discount: value }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRESET_LINE_DISCOUNTS.map((pct) => (
                  <SelectItem key={pct} value={String(pct)}>
                    {pct === 0 ? "No discount" : `${pct}% off`}
                  </SelectItem>
                ))}
                <SelectItem value="custom">Custom %</SelectItem>
              </SelectContent>
            </Select>
            {form.discount === "custom" ? (
              <Input
                type="number"
                min={0}
                max={100}
                step={0.5}
                value={form.customDiscount}
                onChange={(e) => setForm((f) => ({ ...f, customDiscount: e.target.value }))}
                placeholder="Enter discount %"
              />
            ) : null}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Add to bill
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
