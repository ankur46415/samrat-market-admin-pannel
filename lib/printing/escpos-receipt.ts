import type { ReceiptData } from "@/lib/printing/receipt-data"

const ESC = 0x1b
const GS = 0x1d
const LF = 0x0a

function concat(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((sum, c) => sum + c.length, 0)
  const out = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    out.set(chunk, offset)
    offset += chunk.length
  }
  return out
}

function cmd(...bytes: number[]): Uint8Array {
  return Uint8Array.from(bytes)
}

function textLine(line: string): Uint8Array {
  const encoder = new TextEncoder()
  const bytes = encoder.encode(line.replace(/[^\x09\x0a\x0d\x20-\x7E]/g, "?"))
  return concat([bytes, cmd(LF)])
}

function formatInr(amount: number): string {
  return `Rs.${Math.round(amount).toLocaleString("en-IN")}`
}

function padLine(left: string, right: string, width: number): string {
  const maxLeft = Math.max(1, width - right.length - 1)
  const trimmedLeft = left.length > maxLeft ? `${left.slice(0, maxLeft - 1)}…` : left
  const spaces = Math.max(1, width - trimmedLeft.length - right.length)
  return trimmedLeft + " ".repeat(spaces) + right
}

/** Build ESC/POS bytes for XPrinter / 80mm thermal printers. */
export function buildEscPosReceipt(receipt: ReceiptData, charsPerLine = 48): Uint8Array {
  const chunks: Uint8Array[] = [
    cmd(ESC, 0x40), // init
    cmd(ESC, 0x61, 0x01), // center
    cmd(GS, 0x21, 0x11), // double size
    textLine("SAMRAT MARKET"),
    cmd(GS, 0x21, 0x00),
    textLine("Retail Invoice"),
    textLine("--------------------------------"),
    cmd(ESC, 0x61, 0x00), // left
    textLine(`Bill: ${receipt.billNo}`),
    textLine(
      `Date: ${receipt.date.toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })}`
    ),
  ]

  if (receipt.customerName) {
    chunks.push(textLine(`Customer: ${receipt.customerName}`))
  }
  if (receipt.customerPhone) {
    chunks.push(textLine(`Phone: ${receipt.customerPhone}`))
  }

  chunks.push(
    textLine("--------------------------------"),
    textLine(padLine("Item", "Amt", charsPerLine)),
    textLine("--------------------------------")
  )

  for (const item of receipt.items) {
    const lineTotal = formatInr(item.total)
    chunks.push(textLine(padLine(`${item.name} x${item.quantity}`, lineTotal, charsPerLine)))
    chunks.push(textLine(`  @ ${formatInr(item.price)} each`))
  }

  chunks.push(textLine("--------------------------------"))

  if (receipt.discount && receipt.discount > 0) {
    chunks.push(textLine(padLine("Discount", `-${formatInr(receipt.discount)}`, charsPerLine)))
  }
  if (receipt.tax && receipt.tax > 0) {
    chunks.push(textLine(padLine("Tax", formatInr(receipt.tax), charsPerLine)))
  }

  chunks.push(
    cmd(ESC, 0x61, 0x02), // right
    cmd(GS, 0x21, 0x01),
    textLine(`TOTAL ${formatInr(receipt.total)}`),
    cmd(GS, 0x21, 0x00),
    cmd(ESC, 0x61, 0x00)
  )

  if (receipt.paymentMethod) {
    chunks.push(textLine(`Payment: ${receipt.paymentMethod.toUpperCase()}`))
  }
  if (receipt.amountPaid != null) {
    chunks.push(textLine(`Paid: ${formatInr(receipt.amountPaid)}`))
  }
  if (receipt.change != null && receipt.change > 0) {
    chunks.push(textLine(`Change: ${formatInr(receipt.change)}`))
  }

  chunks.push(
    cmd(ESC, 0x61, 0x01),
    textLine(""),
    textLine("Thank you! Visit again"),
    textLine(""),
    cmd(ESC, 0x61, 0x00),
    cmd(LF, LF, LF),
    cmd(GS, 0x56, 0x00) // full cut
  )

  return concat(chunks)
}
