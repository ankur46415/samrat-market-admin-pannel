"use client"

import { Eye, Pencil } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ShareBillWhatsAppButton } from "@/components/sales/share-bill-whatsapp-button"
import type { Sale } from "@/lib/types"

export function SaleBillActions({
  sale,
  onView,
  onEdit,
}: {
  sale: Sale
  onView: () => void
  onEdit: () => void
}) {
  return (
    <div className="flex items-center justify-end gap-1">
      <Button type="button" variant="outline" size="sm" className="h-8 shrink-0 gap-1 px-2" onClick={onView}>
        <Eye className="h-4 w-4" />
        View
      </Button>
      <Button type="button" variant="outline" size="sm" className="h-8 shrink-0 gap-1 px-2" onClick={onEdit}>
        <Pencil className="h-4 w-4" />
        Edit
      </Button>
      <ShareBillWhatsAppButton sale={sale} size="sm" />
    </div>
  )
}
