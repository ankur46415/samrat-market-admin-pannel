export type PrinterMode = "serial" | "browser"

export type PrinterSettings = {
  mode: PrinterMode
  autoPrint: boolean
  baudRate: number
  paperWidthMm: 58 | 80
}

const STORAGE_KEY = "samrat_printer_settings"

const DEFAULTS: PrinterSettings = {
  mode: "browser",
  autoPrint: true,
  baudRate: 9600,
  paperWidthMm: 80,
}

function defaultModeForDevice(): PrinterMode {
  if (typeof navigator === "undefined") return "browser"
  // Most XPrinter units on Windows use the installed driver, not a Web Serial COM port.
  return /Win/i.test(navigator.userAgent) ? "browser" : "serial"
}

export function getPrinterSettings(): PrinterSettings {
  if (typeof window === "undefined") return DEFAULTS
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return { ...DEFAULTS, mode: defaultModeForDevice() }
    }
    const parsed = JSON.parse(raw) as Partial<PrinterSettings>
    return {
      mode: parsed.mode === "browser" ? "browser" : "serial",
      autoPrint: parsed.autoPrint !== false,
      baudRate: parsed.baudRate === 115200 ? 115200 : 9600,
      paperWidthMm: parsed.paperWidthMm === 58 ? 58 : 80,
    }
  } catch {
    return DEFAULTS
  }
}

export function savePrinterSettings(settings: Partial<PrinterSettings>): PrinterSettings {
  const next = { ...getPrinterSettings(), ...settings }
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  }
  return next
}
