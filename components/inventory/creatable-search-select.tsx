"use client"

import { useLayoutEffect, useMemo, useRef, useState } from "react"
import { Check, ChevronsUpDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"

type CreatableSearchSelectProps = {
  id?: string
  value: string
  onChange: (value: string) => void
  options: string[]
  placeholder?: string
  inputClassName?: string
  className?: string
}

export function CreatableSearchSelect({
  id,
  value,
  onChange,
  options,
  placeholder,
  inputClassName,
  className,
}: CreatableSearchSelectProps) {
  const [open, setOpen] = useState(false)
  const [popoverWidth, setPopoverWidth] = useState<number | undefined>()
  const fieldRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    if (!open) return
    const el = fieldRef.current
    if (!el) return
    const sync = () => setPopoverWidth(el.offsetWidth)
    sync()
    window.addEventListener("resize", sync)
    return () => window.removeEventListener("resize", sync)
  }, [open])

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

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <div ref={fieldRef} className={cn("flex w-full", className)}>
          <Input
            id={id}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className={cn(inputClassName, "min-w-0 flex-1 rounded-r-none border-r-0 pr-3")}
          />
          <Button
            type="button"
            variant="outline"
            className="h-11 shrink-0 rounded-l-none border-border/80 px-3 shadow-sm"
            aria-label="Browse list"
            aria-expanded={open}
            onClick={() => setOpen((prev) => !prev)}
          >
            <ChevronsUpDown className="h-4 w-4 opacity-50" />
          </Button>
        </div>
      </PopoverAnchor>
      <PopoverContent
        side="bottom"
        align="start"
        sideOffset={4}
        avoidCollisions
        collisionPadding={8}
        className="p-0"
        style={popoverWidth ? { width: popoverWidth } : undefined}
      >
        <Command>
          <CommandInput placeholder="Search…" />
          <CommandList>
            <CommandEmpty>No match — type in the field to add new.</CommandEmpty>
            <CommandGroup>
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
                      value.trim() === opt ? "opacity-100" : "opacity-0"
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
