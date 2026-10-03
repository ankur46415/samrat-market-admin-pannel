"use client"

import { useRef } from "react"
import Barcode from "react-barcode"
import { Printer } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import type { Product } from "@/lib/types"

interface BarcodeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  product: Product | null
}

export function BarcodeDialog({ open, onOpenChange, product }: BarcodeDialogProps) {
  const printRef = useRef<HTMLDivElement>(null)

  if (!product) return null

  const handlePrint = () => {
    const content = printRef.current
    if (!content) return

    const printWindow = window.open("", "_blank")
    if (!printWindow) return

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Barcode - ${product.name}</title>
          <style>
            body {
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              min-height: 100vh;
              margin: 0;
              font-family: system-ui, sans-serif;
            }
            .barcode-container {
              text-align: center;
              padding: 20px;
            }
            .product-name {
              font-size: 14px;
              font-weight: 600;
              margin-bottom: 8px;
            }
            .product-price {
              font-size: 16px;
              font-weight: 700;
              margin-top: 8px;
            }
            @media print {
              body { margin: 0; }
            }
          </style>
        </head>
        <body>
          ${content.innerHTML}
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

  const barcodeValue = product.barcode || product.id.slice(0, 12)

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Product Barcode</DialogTitle>
          <DialogDescription>
            Print barcode label for {product.name}
          </DialogDescription>
        </DialogHeader>
        
        <div
          ref={printRef}
          className="barcode-container flex flex-col items-center justify-center py-6 bg-white rounded-lg"
        >
          <p className="product-name text-sm font-semibold text-foreground mb-2">
            {product.name}
          </p>
          <Barcode
            value={barcodeValue}
            width={1.5}
            height={60}
            fontSize={12}
            margin={10}
            background="#ffffff"
          />
          <p className="product-price text-base font-bold text-foreground mt-2">
            {formatCurrency(product.price)}
          </p>
        </div>

        <div className="flex justify-end">
          <Button onClick={handlePrint}>
            <Printer className="mr-2 h-4 w-4" />
            Print Barcode
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
