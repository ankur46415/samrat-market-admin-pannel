"use client"

import { useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { EditableLiveItem } from "@/components/live-billing/live-bill-items-editor"
import {
  PRESET_LINE_DISCOUNTS,
  isPresetLineDiscount,
  parseDiscountInput,
} from "@/lib/billing/line-discount"

export function PosLineDiscountCell({
  item,
  disabled,
  updating,
  onChange,
}: {
  item: EditableLiveItem
  disabled?: boolean
  updating?: boolean
  onChange: (item: EditableLiveItem, discountPercent: number) => void
}) {
  const preset = isPresetLineDiscount(item.discountPercent)
  const [mode, setMode] = useState<"preset" | "custom">(preset ? "preset" : "custom")
  const [customValue, setCustomValue] = useState(
    preset ? "" : String(item.discountPercent || "")
  )

  useEffect(() => {
    const isPreset = isPresetLineDiscount(item.discountPercent)
    setMode(isPreset ? "preset" : "custom")
    setCustomValue(isPreset ? "" : String(item.discountPercent || ""))
  }, [item.discountPercent])

  const applyCustom = () => {
    const parsed = parseDiscountInput(customValue)
    if (parsed == null) return
    onChange(item, parsed)
  }

  return (
    <div className="flex min-w-[7rem] flex-col items-end gap-1" onClick={(e) => e.stopPropagation()}>
      {updating ? (
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      ) : (
        <>
          <Select
            value={mode === "custom" ? "custom" : String(item.discountPercent ?? 0)}
            disabled={disabled}
            onValueChange={(value) => {
              if (value === "custom") {
                setMode("custom")
                setCustomValue(item.discountPercent ? String(item.discountPercent) : "")
                return
              }
              setMode("preset")
              onChange(item, Number(value))
            }}
          >
            <SelectTrigger className="h-8 w-[5.5rem] text-xs">
              <SelectValue placeholder="0%" />
            </SelectTrigger>
            <SelectContent>
              {PRESET_LINE_DISCOUNTS.map((pct) => (
                <SelectItem key={pct} value={String(pct)}>
                  {pct === 0 ? "No discount" : `${pct}%`}
                </SelectItem>
              ))}
              <SelectItem value="custom">Custom %</SelectItem>
            </SelectContent>
          </Select>

          {mode === "custom" ? (
            <div className="flex items-center gap-1">
              <Input
                type="number"
                min={0}
                max={100}
                step={0.5}
                disabled={disabled}
                value={customValue}
                onChange={(e) => setCustomValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    applyCustom()
                  }
                }}
                onBlur={applyCustom}
                className="h-7 w-14 px-1 text-right text-xs tabular-nums"
                placeholder="%"
              />
              <span className="text-[10px] text-muted-foreground">%</span>
            </div>
          ) : item.discountPercent > 0 ? (
            <span className="text-[10px] font-medium text-primary">−{item.discountPercent}%</span>
          ) : null}
        </>
      )}
    </div>
  )
}
