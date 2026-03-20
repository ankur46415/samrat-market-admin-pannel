"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import type { Customer } from "@/lib/types"
import { toast } from "sonner"

interface AddPaymentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  customer: Customer | null
  onSubmit: (amount: number, notes: string) => Promise<void>
}

export function AddPaymentDialog({
  open,
  onOpenChange,
  customer,
  onSubmit,
}: AddPaymentDialogProps) {
  const [amount, setAmount] = useState("")
  const [notes, setNotes] = useState("")
  const [loading, setLoading] = useState(false)

  if (!customer) return null

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(value)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    const paymentAmount = parseFloat(amount)
    
    if (!paymentAmount || paymentAmount <= 0) {
      toast.error("Please enter a valid amount")
      return
    }

    if (paymentAmount > customer.balance) {
      toast.error("Payment amount cannot exceed balance")
      return
    }

    setLoading(true)

    try {
      await onSubmit(paymentAmount, notes)
      toast.success("Payment recorded successfully")
      onOpenChange(false)
      setAmount("")
      setNotes("")
    } catch (error) {
      console.error("Payment error:", error)
      toast.error("Failed to record payment")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record Payment</DialogTitle>
          <DialogDescription>
            Record a payment from {customer.name}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="rounded-lg bg-muted p-4">
              <p className="text-sm text-muted-foreground">Outstanding Balance</p>
              <p className="text-2xl font-bold text-destructive">
                {formatCurrency(customer.balance)}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="amount">Payment Amount (INR) *</Label>
              <Input
                id="amount"
                type="number"
                min="0"
                max={customer.balance}
                step="0.01"
                placeholder="Enter amount"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
              <Button
                type="button"
                variant="link"
                size="sm"
                className="h-auto p-0 text-xs"
                onClick={() => setAmount(customer.balance.toString())}
              >
                Pay Full Balance
              </Button>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Textarea
                id="notes"
                placeholder="e.g., Cash payment, UPI reference..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Recording..." : "Record Payment"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
