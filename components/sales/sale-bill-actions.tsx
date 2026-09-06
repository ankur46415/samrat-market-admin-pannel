"use client"

import { Eye, Pencil } from "lucide-react"
import { Button } from "@/components/ui/button"

export function SaleBillActions({
  onView,
  onEdit,
}: {
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
    </div>
  )
}
