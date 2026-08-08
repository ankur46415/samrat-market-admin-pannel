"use client"

import { useEffect, useRef, useState } from "react"
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
  onOpenChange,
  onAdded,
}: {
  sessionId: string | null
  disabled?: boolean
  onOpenChange?: (open: boolean) => void
  onAdded?: () => void
}) {
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const nameInputRef = useRef<HTMLInputElement>(null)

  const reset = () => setForm(EMPTY_FORM)

  const setDialogOpen = (next: boolean) => {
    setOpen(next)
    onOpenChange?.(next)
    if (!next) reset()
  }

  useEffect(() => {
    if (!open) return
    const t = window.setTimeout(() => nameInputRef.current?.focus(), 50)
    return () => window.clearTimeout(t)
  }, [open])

  const updateField = <K extends keyof typeof EMPTY_FORM>(key: K, value: (typeof EMPTY_FORM)[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

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
      setDialogOpen(false)
      onAdded?.()
    } catch (err) {
      console.error(err)
      toast.error(err instanceof Error ? err.message : "Failed to add item")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setDialogOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" disabled={disabled} className="shrink-0 gap-2">
          <PackagePlus className="h-4 w-4" />
          Add Other
        </Button>
      </DialogTrigger>
      <DialogContent
        className="sm:max-w-md"
        onOpenAutoFocus={(e) => {
          e.preventDefault()
          window.setTimeout(() => nameInputRef.current?.focus(), 0)
        }}
      >
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
              ref={nameInputRef}
              id="manual-name"
              value={form.name}
              onChange={(e) => updateField("name", e.target.value)}
              placeholder="e.g. Carry bag, Misc item"
              autoComplete="off"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="manual-qty">Quantity *</Label>
              <Input
                id="manual-qty"
                type="text"
                inputMode="numeric"
                value={form.quantity}
                onChange={(e) => updateField("quantity", e.target.value.replace(/[^\d]/g, ""))}
                autoComplete="off"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="manual-price">Rate (INR) *</Label>
              <Input
                id="manual-price"
                type="text"
                inputMode="decimal"
                value={form.price}
                onChange={(e) => updateField("price", e.target.value.replace(/[^\d.]/g, ""))}
                placeholder="0"
                autoComplete="off"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Discount</Label>
            <Select value={form.discount} onValueChange={(value) => updateField("discount", value)}>
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
                type="text"
                inputMode="decimal"
                value={form.customDiscount}
                onChange={(e) => updateField("customDiscount", e.target.value.replace(/[^\d.]/g, ""))}
                placeholder="Enter discount %"
                autoComplete="off"
              />
            ) : null}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
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
