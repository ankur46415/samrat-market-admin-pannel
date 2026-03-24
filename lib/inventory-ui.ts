import { cn } from "@/lib/utils"

export function inventoryTableFrameClassName(extra?: string) {
  return cn(
    "rounded-xl border border-border/80 bg-card shadow-sm overflow-hidden",
    extra
  )
}

export const invTableHeadClass = cn(
  "h-11 px-4 text-left align-middle text-xs font-semibold uppercase tracking-wider text-muted-foreground",
  "bg-muted/50 border-b border-border/60 first:rounded-tl-xl last:rounded-tr-xl"
)

export const invTableCellClass = "px-4 py-3 align-middle text-sm"

export const invTableCellNumeric = cn(invTableCellClass, "text-right tabular-nums")
