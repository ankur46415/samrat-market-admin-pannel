"use client"

import { useCallback, useEffect, useState } from "react"
import { Loader2, Printer, Settings2, Unplug, Wifi } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { useThermalPrinter } from "@/hooks/use-thermal-printer"
import {
  getPrinterSettings,
  savePrinterSettings,
  type PrinterMode,
  type PrinterSettings,
} from "@/lib/printing/printer-settings"
import { loadLastReceipt } from "@/lib/printing/receipt-data"
import { isPrinterConnectCancelled } from "@/lib/printing/printer-errors"
import { cn } from "@/lib/utils"

export function ThermalPrinterControls({ className }: { className?: string }) {
  const printer = useThermalPrinter()
  const [settings, setSettings] = useState<PrinterSettings>(() => getPrinterSettings())
  const [printing, setPrinting] = useState(false)

  useEffect(() => {
    setSettings(getPrinterSettings())
  }, [])

  const updateSettings = useCallback((patch: Partial<PrinterSettings>) => {
    const next = savePrinterSettings(patch)
    setSettings(next)
  }, [])

  const handleConnect = async () => {
    try {
      await printer.connect()
      toast.success("XPrinter connected")
    } catch (e) {
      if (isPrinterConnectCancelled(e)) {
        toast.info("XPrinter not in USB port list. Use Driver Print mode instead.", {
          duration: 7000,
          action: {
            label: "Switch to Driver Print",
            onClick: () => {
              const next = savePrinterSettings({ mode: "browser" })
              setSettings(next)
              toast.success("Driver Print enabled — complete a bill to print via XPrinter")
            },
          },
        })
        return
      }
      toast.error(e instanceof Error ? e.message : "Failed to connect printer")
    }
  }

  const handleReprint = async () => {
    const receipt = loadLastReceipt()
    if (!receipt) {
      toast.error("No recent bill to reprint")
      return
    }
    setPrinting(true)
    try {
      const mode = await printer.printReceipt(receipt)
      if (mode === "serial") toast.success("Bill sent to XPrinter")
      else toast.success("Print dialog opened — select your XPrinter")
    } catch (e) {
      console.error(e)
      toast.error(e instanceof Error ? e.message : "Print failed")
    } finally {
      setPrinting(false)
    }
  }

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {settings.mode === "serial" ? (
        <Badge
          variant="outline"
          className={cn(
            "gap-1.5",
            printer.connected ? "border-success/40 bg-success/10 text-success" : "text-muted-foreground"
          )}
        >
          <Wifi className="h-3 w-3" />
          {printer.connected ? "XPrinter Ready" : "Printer Offline"}
        </Badge>
      ) : (
        <Badge variant="outline" className="gap-1.5 text-muted-foreground">
          <Printer className="h-3 w-3" />
          Driver Print
        </Badge>
      )}

      {settings.mode === "serial" && printer.supported ? (
        printer.connected ? (
          <Button variant="outline" size="sm" onClick={() => void printer.disconnect()}>
            <Unplug className="mr-1.5 h-4 w-4" />
            Disconnect
          </Button>
        ) : (
          <Button size="sm" disabled={printer.connecting} onClick={() => void handleConnect()}>
            {printer.connecting ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <Wifi className="mr-1.5 h-4 w-4" />
            )}
            Connect XPrinter
          </Button>
        )
      ) : null}

      <Button variant="outline" size="sm" disabled={printing} onClick={() => void handleReprint()}>
        {printing ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Printer className="mr-1.5 h-4 w-4" />}
        Reprint
      </Button>

      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8" title="Printer settings">
            <Settings2 className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-80 space-y-4">
          <div>
            <h4 className="font-semibold">XPrinter Setup</h4>
            <p className="mt-1 text-xs text-muted-foreground">
              XPrinter on Windows usually works with <strong>Driver Print</strong>. Direct USB only if your
              model shows a COM port in the browser list.
            </p>
          </div>

          <div className="space-y-2">
            <Label>Print mode</Label>
            <Select
              value={settings.mode}
              onValueChange={(value: PrinterMode) => updateSettings({ mode: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="serial">Direct USB (Web Serial)</SelectItem>
                <SelectItem value="browser">Windows Driver (Print Dialog)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">
              {settings.mode === "serial"
                ? "Pick your printer COM port in the browser dialog. If the list is empty, switch to Driver Print."
                : "Opens print dialog — set XPrinter as default Windows printer for one-click printing."}
            </p>
          </div>

          <div className="space-y-2">
            <Label>Paper width</Label>
            <Select
              value={String(settings.paperWidthMm)}
              onValueChange={(value) => updateSettings({ paperWidthMm: value === "58" ? 58 : 80 })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="80">80 mm (standard)</SelectItem>
                <SelectItem value="58">58 mm</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {settings.mode === "serial" ? (
            <div className="space-y-2">
              <Label>Baud rate</Label>
              <Select
                value={String(settings.baudRate)}
                onValueChange={(value) =>
                  updateSettings({ baudRate: value === "115200" ? 115200 : 9600 })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="9600">9600 (most XPrinter)</SelectItem>
                  <SelectItem value="115200">115200</SelectItem>
                </SelectContent>
              </Select>
            </div>
          ) : null}

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">Auto-print on bill complete</p>
              <p className="text-xs text-muted-foreground">Print immediately after F10</p>
            </div>
            <Switch
              checked={settings.autoPrint}
              onCheckedChange={(checked) => updateSettings({ autoPrint: checked })}
            />
          </div>

          {!printer.supported && settings.mode === "serial" ? (
            <p className="rounded-md bg-warning/10 p-2 text-xs text-warning-foreground">
              Web Serial not available in this browser. Switch to Driver Print mode or use Chrome/Edge.
            </p>
          ) : null}
        </PopoverContent>
      </Popover>
    </div>
  )
}
