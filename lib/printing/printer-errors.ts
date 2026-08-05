/** User closed the browser port picker without choosing a device. */
export class PrinterConnectCancelledError extends Error {
  constructor() {
    super("No printer port selected")
    this.name = "PrinterConnectCancelledError"
  }
}

export function isPrinterConnectCancelled(error: unknown): boolean {
  if (error instanceof PrinterConnectCancelledError) return true
  if (error instanceof DOMException && error.name === "NotFoundError") return true
  if (error instanceof Error && /no port selected/i.test(error.message)) return true
  return false
}
