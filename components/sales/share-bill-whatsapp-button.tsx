"use client"

import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { billPhoneLinked, shareSaleOnWhatsApp } from "@/lib/printing/bill-whatsapp"
import type { Sale } from "@/lib/types"

export function ShareBillWhatsAppButton({
  sale,
  size = "default",
  className,
}: {
  sale: Sale
  size?: "default" | "sm"
  className?: string
}) {
  const canShare = billPhoneLinked(sale.customerPhone)

  return (
    <Button
      type="button"
      variant="outline"
      size={size}
      className={className ?? (size === "sm" ? "h-8 shrink-0 gap-1 px-2" : undefined)}
      disabled={!canShare}
      title={canShare ? "Share this bill on WhatsApp" : "Link a customer phone on the bill to share"}
      onClick={() => {
        if (!shareSaleOnWhatsApp(sale)) {
          toast.error("No customer phone on this bill")
        }
      }}
    >
      WhatsApp
    </Button>
  )
}