"use client"

import { format } from "date-fns"
import { Pencil, Printer } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { Sale } from "@/lib/types"
import { mrpDiscountPercent } from "@/lib/billing/line-discount"
import { useProducts } from "@/hooks/use-firestore"
import { attachCatalogMrp, receiptYouSaved } from "@/lib/printing/receipt-data"
import { printReceiptInBrowser } from "@/lib/printing/receipt-html"

interface SaleDetailDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  sale: Sale | null
  onEdit?: () => void
}

export function SaleDetailDialog({ open, onOpenChange, sale, onEdit }: SaleDetailDialogProps) {
  const { products } = useProducts()
  if (!sale) return null

  const catalog = products.map((p) => ({ id: p.id, barcode: p.barcode, mrp: p.mrp }))
  const items = attachCatalogMrp(
    sale.items.map((item) => ({
      ...item,
      barcode: item.productId,
    })),
    catalog
  )
  const mrpSavingsTotal = receiptYouSaved(
    items.map((item) => ({
      name: item.productName,
      quantity: item.quantity,
      price: item.price,
      total: item.total,
      mrp: item.mrp,
      discountPercent: item.discountPercent,
    }))
  )

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount)
  }

  const getPaymentBadge = (method: string) => {
    const variants: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
      cash: "default",
      upi: "secondary",
      card: "outline",
      credit: "destructive",
    }
    return variants[method] || "default"
  }

  const handlePrint = () => {
    printReceiptInBrowser({
      billNo: sale.billNo,
      date: sale.createdAt,
      customerName: sale.customerName,
      customerPhone: sale.customerPhone,
      items: items.map((item) => ({
        name: item.productName,
        quantity: item.quantity,
        price: item.price,
        total: item.total,
        mrp: item.mrp,
        discountPercent: item.discountPercent,
      })),
      subtotal: sale.subtotal,
      discount: sale.discount,
      mrpSavings: mrpSavingsTotal,
      tax: sale.tax,
      total: sale.total,
      paymentMethod: sale.paymentMethod,
      amountPaid: sale.amountPaid,
      change: sale.change,
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col overflow-hidden sm:max-w-lg">
        <DialogHeader className="shrink-0">
          <div className="flex items-center justify-between pr-8">
            <div>
              <DialogTitle>Invoice {sale.billNo}</DialogTitle>
              <DialogDescription>
                {format(sale.createdAt, "MMMM dd, yyyy 'at' h:mm a")}
              </DialogDescription>
            </div>
            <Badge variant={getPaymentBadge(sale.paymentMethod)}>
              {sale.paymentMethod.toUpperCase()}
            </Badge>
          </div>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
          <div className="flex shrink-0 justify-between text-sm">
            <span className="text-muted-foreground">Customer</span>
            <span className="font-medium">{sale.customerName || "Walk-in Customer"}</span>
          </div>
          <div className="flex shrink-0 justify-between text-sm">
            <span className="text-muted-foreground">Phone</span>
            <span className="font-medium font-mono">{sale.customerPhone || "NA"}</span>
          </div>

          <Separator className="shrink-0" />

          <div className="min-h-0 flex-1 overflow-y-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="sticky top-0 z-10 bg-background">Item</TableHead>
                  <TableHead className="sticky top-0 z-10 bg-background text-right">Qty</TableHead>
                  <TableHead className="sticky top-0 z-10 bg-background text-right">Price</TableHead>
                  <TableHead className="sticky top-0 z-10 bg-background text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium">
                      {item.productName}
                      {item.mrp && item.mrp > item.price ? (
                        <p className="mt-0.5 text-[11px] font-semibold text-primary">
                          MRP {formatCurrency(item.mrp)} · −{mrpDiscountPercent(item.mrp, item.price)}% off
                        </p>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-right">{item.quantity}</TableCell>
                    <TableCell className="text-right">
                      {item.mrp && item.mrp > item.price ? (
                        <div>
                          <span className="text-xs text-muted-foreground line-through">
                            {formatCurrency(item.mrp)}
                          </span>
                          <p>{formatCurrency(item.price)}</p>
                        </div>
                      ) : (
                        formatCurrency(item.price)
                      )}
                    </TableCell>
                    <TableCell className="text-right">{formatCurrency(item.total)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="shrink-0 space-y-2 rounded-lg bg-muted p-4">
            <div className="flex justify-between text-sm">
              <span>Subtotal</span>
              <span>{formatCurrency(sale.subtotal)}</span>
            </div>
            {mrpSavingsTotal > 0 && (
              <div className="flex justify-between text-sm font-medium text-green-700 dark:text-green-400">
                <span>MRP savings</span>
                <span>-{formatCurrency(mrpSavingsTotal)}</span>
              </div>
            )}
            {sale.discount > 0 && (
              <div className="flex justify-between text-sm text-green-600">
                <span>Bill discount</span>
                <span>-{formatCurrency(sale.discount)}</span>
              </div>
            )}
            {sale.tax > 0 && (
              <div className="flex justify-between text-sm">
                <span>Tax</span>
                <span>{formatCurrency(sale.tax)}</span>
              </div>
            )}
            <Separator />
            <div className="flex justify-between text-lg font-semibold">
              <span>Total</span>
              <span>{formatCurrency(sale.total)}</span>
            </div>
            {sale.paymentMethod === "cash" && sale.change > 0 && (
              <>
                <div className="flex justify-between text-sm">
                  <span>Paid</span>
                  <span>{formatCurrency(sale.amountPaid)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Change</span>
                  <span>{formatCurrency(sale.change)}</span>
                </div>
              </>
            )}
          </div>

          <div className="flex shrink-0 justify-end gap-2">
            {onEdit ? (
              <Button
                variant="outline"
                onClick={() => {
                  onOpenChange(false)
                  onEdit()
                }}
              >
                <Pencil className="mr-2 h-4 w-4" />
                Edit bill
              </Button>
            ) : null}
            <Button variant="outline" onClick={handlePrint}>
              <Printer className="mr-2 h-4 w-4" />
              Print
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
