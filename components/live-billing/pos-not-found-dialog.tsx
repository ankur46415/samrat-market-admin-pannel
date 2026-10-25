"use client"

import { useEffect, useRef, useState } from "react"
import { AlertTriangle, Loader2, PackagePlus } from "lucide-react"
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
} from "@/components/ui/dialog"

type ManualForm = {
  name: string
  quantity: string
  price: string
}

const EMPTY_FORM: ManualForm = { name: "", quantity: "1", price: "" }

export function PosNotFoundDialog({
  open,
  barcode,
  adding,
  onDismiss,
  onAddToList,
}: {
  open: boolean
  barcode: string | null
  adding?: boolean
  onDismiss: () => void
  onAddToList: (input: { name: string; quantity: number; price: number }) => Promise<void>
}) {
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const nameInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) {
      setShowForm(false)
      setForm(EMPTY_FORM)
    }
  }, [open])

  useEffect(() => {
    if (!open || !showForm) return
    const t = window.setTimeout(() => nameInputRef.current?.focus(), 50)
    return () => window.clearTimeout(t)
  }, [open, showForm])

  const handleAdd = async () => {
    const name = form.name.trim()
    const quantity = Math.floor(Number(form.quantity))
    const price = Number(form.price)
    if (!name) {
      toast.error("Enter a product name")
      return
    }
    if (!Number.isFinite(quantity) || quantity < 1) {
      toast.error("Enter a valid quantity")
      return
    }
    if (!Number.isFinite(price) || price < 0) {
      toast.error("Enter a valid rate")
      return
    }
    await onAddToList({ name, quantity, price })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onDismiss()
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="border-destructive/40 sm:max-w-md"
        onOpenAutoFocus={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        onKeyDown={(e) => {
          const target = e.target as HTMLElement
          const inField = target.tagName === "INPUT" || target.tagName === "TEXTAREA"
          if (inField) return
          if (e.key.length === 1 || e.key === "Enter") {
            e.preventDefault()
            e.stopPropagation()
          }
        }}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Item not found
          </DialogTitle>
          <DialogDescription>
            This barcode is not in inventory. Scan stays locked until you dismiss this alert.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-destructive">Barcode</p>
          <p className="mt-0.5 font-mono text-lg font-bold text-foreground">{barcode || "—"}</p>
        </div>

        {showForm ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Add this item to the bill manually.</p>
            <div className="space-y-1.5">
              <Label htmlFor="not-found-name">Product name *</Label>
              <Input
                ref={nameInputRef}
                id="not-found-name"
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="Enter name"
                autoComplete="off"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    void handleAdd()
                  }
                }}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="not-found-qty">Qty *</Label>
                <Input
                  id="not-found-qty"
                  inputMode="numeric"
                  value={form.quantity}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, quantity: e.target.value.replace(/[^\d]/g, "") }))
                  }
                  autoComplete="off"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="not-found-price">Rate (INR) *</Label>
                <Input
                  id="not-found-price"
                  inputMode="decimal"
                  value={form.price}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, price: e.target.value.replace(/[^\d.]/g, "") }))
                  }
                  placeholder="0"
                  autoComplete="off"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault()
                      void handleAdd()
                    }
                  }}
                />
              </div>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Use <span className="font-semibold text-foreground">Add to list</span> to enter name and
            rate, or dismiss to keep scanning.
          </p>
        )}

        <DialogFooter className="gap-2 sm:justify-between">
          <Button type="button" variant="outline" disabled={adding} onClick={onDismiss}>
            Dismiss
          </Button>
          {showForm ? (
            <Button type="button" disabled={adding} onClick={() => void handleAdd()}>
              {adding ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PackagePlus className="mr-2 h-4 w-4" />}
              Add to list
            </Button>
          ) : (
            <Button type="button" onClick={() => setShowForm(true)}>
              <PackagePlus className="mr-2 h-4 w-4" />
              Add to list
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
