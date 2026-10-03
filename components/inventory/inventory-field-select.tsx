"use client"

import { useMemo, useState } from "react"
import { Check, ChevronsUpDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

type InventoryFieldSelectProps = {
  id?: string
  value: string
  onChange: (value: string) => void
  options: string[]
  placeholder?: string
  allowEmpty?: boolean
  emptyLabel?: string
  className?: string
  triggerClassName?: string
  disabled?: boolean
}

export function InventoryFieldSelect({
  id,
  value,
  onChange,
  options,
  placeholder = "Select…",
  allowEmpty = true,
  emptyLabel = "None",
  className,
  triggerClassName,
  disabled,
}: InventoryFieldSelectProps) {
  const [open, setOpen] = useState(false)

  const sortedOptions = useMemo(() => {
    const seen = new Set<string>()
    const list: string[] = []
    for (const raw of options) {
      const t = raw.trim()
      if (!t || seen.has(t)) continue
      seen.add(t)
      list.push(t)
    }
    list.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }))
    return list
  }, [options])

  const trimmed = value.trim()
  const isRegistered = trimmed.length > 0 && sortedOptions.includes(trimmed)
  const display = isRegistered ? trimmed : placeholder

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "h-11 w-full justify-between rounded-lg border-border/80 font-normal shadow-sm",
            !isRegistered && "text-muted-foreground",
            triggerClassName
          )}
        >
          <span className="truncate">{display}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className={cn("w-[var(--radix-popover-trigger-width)] p-0", className)} align="start">
        <Command>
          <CommandInput placeholder="Search…" />
          <CommandList>
            <CommandEmpty>No matches in list.</CommandEmpty>
            <CommandGroup>
              {allowEmpty ? (
                <CommandItem
                  value="__empty__"
                  onSelect={() => {
                    onChange("")
                    setOpen(false)
                  }}
                >
                  <Check className={cn("mr-2 h-4 w-4", isRegistered ? "opacity-0" : "opacity-100")} />
                  {emptyLabel}
                </CommandItem>
              ) : null}
              {sortedOptions.map((opt) => (
                <CommandItem
                  key={opt}
                  value={opt}
                  onSelect={() => {
                    onChange(opt)
                    setOpen(false)
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4 shrink-0",
                      isRegistered && trimmed === opt ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {opt}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
