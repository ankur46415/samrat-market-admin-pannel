import type { ReceiptData, ReceiptLineItem } from "@/lib/printing/receipt-data"
import { lineYouSaved, receiptMrpTotal, receiptYouSaved, withReceiptSavings } from "@/lib/printing/receipt-data"
import { mrpDiscountPercent } from "@/lib/billing/line-discount"

function formatInr(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount)
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function lineDiscountNote(item: ReceiptLineItem): string {
  const finalUnit = item.price
  const saved = lineYouSaved(item)
  const parts: string[] = []

  if (item.mrp && item.mrp > finalUnit) {
    const pct = mrpDiscountPercent(item.mrp, finalUnit)
    parts.push(`MRP ${formatInr(item.mrp)} · ${pct}% off · Save ${formatInr(saved)}`)
  } else if (item.discountPercent && item.discountPercent > 0) {
    parts.push(`Disc ${item.discountPercent}% · Save ${formatInr(saved)}`)
  } else if (saved > 0) {
    parts.push(`Save ${formatInr(saved)}`)
  }

  if (parts.length === 0) return ""
  return `<br /><span class="save">${escapeHtml(parts.join(" · "))}</span>`
}

function lineRateHtml(item: ReceiptLineItem): string {
  const finalUnit = item.price
  if (item.mrp && item.mrp > finalUnit) {
    return `<s>${formatInr(item.mrp)}</s> ${formatInr(finalUnit)}`
  }
  if (item.basePrice && item.basePrice > finalUnit) {
    return `<s>${formatInr(item.basePrice)}</s> ${formatInr(finalUnit)}`
  }
  return formatInr(finalUnit)
}

/** 80mm / 58mm thermal receipt HTML for browser print (XPrinter driver). */
export function buildReceiptPrintHtml(receipt: ReceiptData, paperWidthMm: 58 | 80 = 80): string {
  const data = withReceiptSavings(receipt)
  const youSaved = receiptYouSaved(data.items)
  const mrpTotal = receiptMrpTotal(data.items)
  const billDiscount = data.discount && data.discount > 0 ? data.discount : 0

  const itemRows = data.items
    .map((item) => {
      return `
      <tr>
        <td>${escapeHtml(item.name)}${lineDiscountNote(item)}<br /><span class="qty">x${item.quantity} @ ${lineRateHtml(item)}</span></td>
        <td class="right">${formatInr(item.total)}</td>
      </tr>`
    })
    .join("")

  const totalsRows = [
    mrpTotal > data.total
      ? `<tr><td>MRP Total</td><td class="right">${formatInr(mrpTotal)}</td></tr>`
      : "",
    data.subtotal > 0 && data.subtotal !== data.total
      ? `<tr><td>Subtotal</td><td class="right">${formatInr(data.subtotal)}</td></tr>`
      : "",
    youSaved > 0
      ? `<tr><td class="save">Discount / You Saved</td><td class="right save">-${formatInr(youSaved)}</td></tr>`
      : "",
    billDiscount > 0 && billDiscount !== youSaved
      ? `<tr><td>Extra bill discount</td><td class="right">-${formatInr(billDiscount)}</td></tr>`
      : "",
    `<tr>
      <td class="total">TOTAL</td>
      <td class="total right">${formatInr(data.total)}</td>
    </tr>`,
    youSaved > 0
      ? `<tr><td colspan="2" class="center save saved-banner">You saved ${formatInr(youSaved)}</td></tr>`
      : "",
  ]
    .filter(Boolean)
    .join("")

  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Bill ${escapeHtml(data.billNo)}</title>
    <style>
      @page { size: ${paperWidthMm}mm auto; margin: 2mm; }
      * { box-sizing: border-box; }
      body {
        width: ${paperWidthMm}mm;
        margin: 0 auto;
        padding: 4mm 3mm;
        font-family: "Courier New", Courier, monospace;
        font-size: 11px;
        font-weight: 700;
        line-height: 1.35;
        color: #000;
        background: #fff;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .center { text-align: center; }
      .bold { font-weight: 700; }
      .title { font-size: 16px; font-weight: 700; margin: 0; }
      .qty { font-size: 10px; }
      .save { font-size: 10px; }
      .saved-banner { padding-top: 4px; font-size: 12px; }
      .divider { border-top: 1px dashed #000; margin: 6px 0; }
      table { width: 100%; border-collapse: collapse; }
      td { vertical-align: top; padding: 2px 0; font-weight: 700; }
      .right { text-align: right; white-space: nowrap; }
      .total { font-size: 14px; font-weight: 700; }
      .footer { margin-top: 8px; font-size: 10px; font-weight: 700; }
      @media print {
        body, td, p, div, span { font-weight: 700 !important; color: #000 !important; }
      }
    </style>
  </head>
  <body>
    <div class="center">
      <p class="title">SAMRAT MARKET</p>
      <p>Retail Invoice</p>
    </div>
    <div class="divider"></div>
    <div>
      <div>Bill: <span class="bold">${escapeHtml(data.billNo)}</span></div>
      <div>Date: ${escapeHtml(
        data.date.toLocaleString("en-IN", {
          day: "2-digit",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      )}</div>
      ${data.customerName ? `<div>Customer: ${escapeHtml(data.customerName)}</div>` : ""}
      ${data.customerPhone ? `<div>Phone: ${escapeHtml(data.customerPhone)}</div>` : ""}
      ${data.paymentMethod ? `<div>Payment: ${escapeHtml(data.paymentMethod.toUpperCase())}</div>` : ""}
    </div>
    <div class="divider"></div>
    <table>
      <tbody>
        ${itemRows}
      </tbody>
    </table>
    <div class="divider"></div>
    <table>
      <tbody>
        ${totalsRows}
      </tbody>
    </table>
    <div class="divider"></div>
    <p class="center footer">Thank you! Visit again</p>
    <script>
      window.onload = function () {
        setTimeout(function () { window.print(); }, 250);
      };
    </script>
  </body>
</html>`
}

export function printReceiptInBrowser(receipt: ReceiptData, paperWidthMm: 58 | 80 = 80): void {
  const html = buildReceiptPrintHtml(receipt, paperWidthMm)
  const printWindow = window.open("", "_blank", "width=400,height=700")
  if (!printWindow) {
    throw new Error("Pop-up blocked. Allow pop-ups to print the bill.")
  }
  printWindow.document.write(html)
  printWindow.document.close()
}
