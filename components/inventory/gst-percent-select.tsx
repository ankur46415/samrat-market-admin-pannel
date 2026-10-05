"use client"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { DEFAULT_GST_PERCENTS, gstLabel } from "@/lib/inventory/gst-percent"
import { cn } from "@/lib/utils"

type GstPercentSelectProps = {
  value: number | undefined
  onChange: (gst: number | undefined) => void
  percents?: number[]
  className?: string
  disabled?: boolean
  id?: string
}

export function GstPercentSelect({
  value,
  onChange,
  percents = DEFAULT_GST_PERCENTS,
  className,
  disabled,
  id,
}: GstPercentSelectProps) {
  const listed = value != null && percents.some((p) => Math.abs(p - value) < 0.051)
  const selectValue = value == null ? "none" : String(Math.round(value * 10) / 10)

  return (
    <Select
      disabled={disabled}
      value={selectValue}
      onValueChange={(next) => {
        if (next === "none") onChange(undefined)
        else onChange(Math.round(Number(next) * 10) / 10)
      }}
    >
      <SelectTrigger id={id} className={cn("h-11 rounded-lg border-border/80 shadow-sm", className)}>
        <SelectValue placeholder="Select GST %" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="none">No GST</SelectItem>
        {value != null && !listed ? (
          <SelectItem value={String(value)}>{gstLabel(value)}</SelectItem>
        ) : null}
        {percents.map((percent) => (
          <SelectItem key={percent} value={String(percent)}>
            {gstLabel(percent)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
