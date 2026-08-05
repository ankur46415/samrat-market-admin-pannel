"use client"

import { useRef, useState } from "react"
import { ScanBarcode } from "lucide-react"
import { toast } from "sonner"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { normalizeScannedBarcode } from "@/lib/stock"
import { cn } from "@/lib/utils"

type BarcodeScannerInputProps = {
  id?: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  disabled?: boolean
}

/** Barcode field with USB / Bluetooth scanner gun support (HID keyboard mode). */
export function BarcodeScannerInput({
  id,
  value,
  onChange,
  placeholder = "Scan or type barcode…",
  className,
  disabled,
}: BarcodeScannerInputProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [focused, setFocused] = useState(false)

  const applyBarcode = (raw: string, showToast = true) => {
    const cleaned = normalizeScannedBarcode(raw)
    if (!cleaned) return
    onChange(cleaned)
    if (showToast) toast.success(`Barcode: ${cleaned}`)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter") return
    e.preventDefault()
    applyBarcode(e.currentTarget.value)
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Input
          ref={inputRef}
          id={id}
          value={value}
          disabled={disabled}
          placeholder={placeholder}
          autoComplete="off"
          spellCheck={false}
          inputMode="numeric"
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          className={cn("font-mono text-base", className)}
        />
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          className="shrink-0 gap-2 sm:h-11"
          onClick={() => {
            inputRef.current?.focus()
            toast.message("Scanner ready — scan barcode with gun")
          }}
        >
          <ScanBarcode className="h-4 w-4" />
          Use Scanner
        </Button>
      </div>

      {focused ? (
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="gap-1.5 border-emerald-200 bg-emerald-50 text-emerald-700">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            Scanner ready
          </Badge>
          <span className="text-xs text-muted-foreground">
            USB wire or Bluetooth gun — scan here, or type manually
          </span>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          Click <span className="font-medium">Use Scanner</span> or focus the field, then scan with gun.
        </p>
      )}
    </div>
  )
}
