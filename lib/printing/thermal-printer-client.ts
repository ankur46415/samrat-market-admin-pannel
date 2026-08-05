import { buildEscPosReceipt } from "@/lib/printing/escpos-receipt"
import { printReceiptInBrowser } from "@/lib/printing/receipt-html"
import type { ReceiptData } from "@/lib/printing/receipt-data"
import { getPrinterSettings } from "@/lib/printing/printer-settings"
import { PrinterConnectCancelledError } from "@/lib/printing/printer-errors"

let portRef: SerialPort | null = null

function serialSupported(): boolean {
  return typeof navigator !== "undefined" && "serial" in navigator && !!navigator.serial
}

async function openPort(port: SerialPort): Promise<void> {
  const { baudRate } = getPrinterSettings()
  if (port.readable || port.writable) {
    try {
      await port.close()
    } catch {
      // ignore
    }
  }
  await port.open({ baudRate })
  portRef = port
}

export function isThermalPrinterConnected(): boolean {
  return !!portRef?.writable
}

export function isWebSerialSupported(): boolean {
  return serialSupported()
}

export async function reconnectThermalPrinter(): Promise<boolean> {
  if (!serialSupported()) return false
  try {
    const ports = await navigator.serial!.getPorts()
    if (ports.length === 0) return false
    await openPort(ports[0])
    return true
  } catch (e) {
    console.error("Printer reconnect failed:", e)
    portRef = null
    return false
  }
}

export async function connectThermalPrinter(): Promise<void> {
  if (!serialSupported()) {
    throw new Error("Web Serial is not supported. Use Chrome or Edge on desktop.")
  }
  try {
    const port = await navigator.serial!.requestPort()
    await openPort(port)
  } catch (e) {
    if (e instanceof DOMException && e.name === "NotFoundError") {
      throw new PrinterConnectCancelledError()
    }
    throw e
  }
}

export async function disconnectThermalPrinter(): Promise<void> {
  const port = portRef
  portRef = null
  if (port) {
    try {
      await port.close()
    } catch {
      // ignore
    }
  }
}

async function printEscPos(receipt: ReceiptData): Promise<void> {
  let port = portRef
  if (!port?.writable) {
    const ok = await reconnectThermalPrinter()
    if (!ok) throw new Error("XPrinter not connected. Click Connect Printer first.")
    port = portRef
  }
  if (!port?.writable) throw new Error("Printer port is not writable.")

  const bytes = buildEscPosReceipt(receipt)
  const writer = port.writable.getWriter()
  try {
    await writer.write(bytes)
  } finally {
    writer.releaseLock()
  }
}

export async function printThermalReceipt(
  receipt: ReceiptData
): Promise<"serial" | "browser" | "browser-fallback"> {
  const settings = getPrinterSettings()

  if (settings.mode === "browser") {
    printReceiptInBrowser(receipt, settings.paperWidthMm)
    return "browser"
  }

  if (serialSupported()) {
    try {
      await printEscPos(receipt)
      return "serial"
    } catch (e) {
      console.warn("Serial print failed, falling back to browser print:", e)
      printReceiptInBrowser(receipt, settings.paperWidthMm)
      return "browser-fallback"
    }
  }

  printReceiptInBrowser(receipt, settings.paperWidthMm)
  return "browser-fallback"
}
