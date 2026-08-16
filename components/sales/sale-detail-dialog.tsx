"use client"

import { format } from "date-fns"
import { FileDown, Printer } from "lucide-react"
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

interface SaleDetailDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  sale: Sale | null
}

export function SaleDetailDialog({ open, onOpenChange, sale }: SaleDetailDialogProps) {
  if (!sale) return null

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
    const printWindow = window.open("", "_blank")
    if (!printWindow) return

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Invoice - ${sale.billNo}</title>
          <style>
            body {
              font-family: system-ui, sans-serif;
              max-width: 400px;
              margin: 0 auto;
              padding: 20px;
            }
            .header { text-align: center; margin-bottom: 20px; }
            .header h1 { font-size: 24px; margin: 0; }
            .header p { color: #666; margin: 5px 0; }
            .info { margin-bottom: 20px; }
            .info-row { display: flex; justify-content: space-between; margin: 5px 0; }
            table { width: 100%; border-collapse: collapse; margin: 20px 0; }
            th, td { padding: 8px; text-align: left; border-bottom: 1px solid #eee; }
            th { font-weight: 600; }
            .total-row td { font-weight: bold; border-top: 2px solid #333; }
            .amount { text-align: right; }
            .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
            @media print {
              body { padding: 0; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <img
              src="/images/samrat-market-logo.png"
              alt="Samrat Market"
              style="width:72px;height:72px;object-fit:cover;border-radius:12px;display:block;margin:0 auto 8px auto;"
            />
            <h1 style="margin:0;font-size:22px;">Samrat Market</h1>
            <p>Tax Invoice</p>
          </div>
          
          <div class="info">
            <div class="info-row">
              <span>Bill No:</span>
              <span>${sale.billNo}</span>
            </div>
            <div class="info-row">
              <span>Date:</span>
              <span>${format(sale.createdAt, "MMM dd, yyyy h:mm a")}</span>
            </div>
            <div class="info-row">
              <span>Customer:</span>
              <span>${sale.customerName || "Walk-in Customer"}</span>
            </div>
            <div class="info-row">
              <span>Payment:</span>
              <span>${sale.paymentMethod.toUpperCase()}</span>
            </div>
          </div>
          
          <table>
            <thead>
              <tr>
                <th>Item</th>
                <th class="amount">Qty</th>
                <th class="amount">Price</th>
                <th class="amount">Total</th>
              </tr>
            </thead>
            <tbody>
              ${sale.items.map(item => `
                <tr>
                  <td>${item.productName}</td>
                  <td class="amount">${item.quantity}</td>
                  <td class="amount">${formatCurrency(item.price)}</td>
                  <td class="amount">${formatCurrency(item.total)}</td>
                </tr>
              `).join("")}
              <tr>
                <td colspan="3">Subtotal</td>
                <td class="amount">${formatCurrency(sale.subtotal)}</td>
              </tr>
              ${sale.discount > 0 ? `
                <tr>
                  <td colspan="3">Discount</td>
                  <td class="amount">-${formatCurrency(sale.discount)}</td>
                </tr>
              ` : ""}
              ${sale.tax > 0 ? `
                <tr>
                  <td colspan="3">Tax</td>
                  <td class="amount">${formatCurrency(sale.tax)}</td>
                </tr>
              ` : ""}
              <tr class="total-row">
                <td colspan="3">Total</td>
                <td class="amount">${formatCurrency(sale.total)}</td>
              </tr>
            </tbody>
          </table>
          
          <div class="footer">
            <p>Thank you for shopping with us!</p>
          </div>
          
          <script>
            window.onload = function() {
              window.print();
              window.close();
            }
          </script>
        </body>
      </html>
    `)
    printWindow.document.close()
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
                {sale.items.map((item, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium">{item.productName}</TableCell>
                    <TableCell className="text-right">{item.quantity}</TableCell>
                    <TableCell className="text-right">{formatCurrency(item.price)}</TableCell>
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
            {sale.discount > 0 && (
              <div className="flex justify-between text-sm text-green-600">
                <span>Discount</span>
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
