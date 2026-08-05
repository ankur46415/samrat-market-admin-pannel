import type { ReceiptData } from "@/lib/printing/receipt-data"

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

/** 80mm / 58mm thermal receipt HTML for browser print (XPrinter driver). */
export function buildReceiptPrintHtml(receipt: ReceiptData, paperWidthMm: 58 | 80 = 80): string {
  const itemRows = receipt.items
    .map(
      (item) => `
      <tr>
        <td>${escapeHtml(item.name)}<br /><span class="muted">x${item.quantity} @ ${formatInr(item.price)}</span></td>
        <td class="right">${formatInr(item.total)}</td>
      </tr>`
    )
    .join("")

  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Bill ${escapeHtml(receipt.billNo)}</title>
    <style>
      @page { size: ${paperWidthMm}mm auto; margin: 2mm; }
      * { box-sizing: border-box; }
      body {
        width: ${paperWidthMm}mm;
        margin: 0 auto;
        padding: 4mm 3mm;
        font-family: "Courier New", Courier, monospace;
        font-size: 11px;
        line-height: 1.35;
        color: #000;
        background: #fff;
      }
      .center { text-align: center; }
      .bold { font-weight: 700; }
      .title { font-size: 16px; font-weight: 700; margin: 0; }
      .muted { color: #444; font-size: 10px; }
      .divider { border-top: 1px dashed #000; margin: 6px 0; }
      table { width: 100%; border-collapse: collapse; }
      td { vertical-align: top; padding: 2px 0; }
      .right { text-align: right; white-space: nowrap; }
      .total { font-size: 14px; font-weight: 700; }
      .footer { margin-top: 8px; font-size: 10px; }
    </style>
  </head>
  <body>
    <div class="center">
      <img src="/images/samrat-market-logo.png" alt="" width="48" height="48" style="border-radius:8px;" onerror="this.style.display='none'" />
      <p class="title">SAMRAT MARKET</p>
      <p class="muted">Retail Invoice</p>
    </div>
    <div class="divider"></div>
    <div>
      <div>Bill: <span class="bold">${escapeHtml(receipt.billNo)}</span></div>
      <div>Date: ${escapeHtml(
        receipt.date.toLocaleString("en-IN", {
          day: "2-digit",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      )}</div>
      ${receipt.customerName ? `<div>Customer: ${escapeHtml(receipt.customerName)}</div>` : ""}
      ${receipt.customerPhone ? `<div>Phone: ${escapeHtml(receipt.customerPhone)}</div>` : ""}
      ${receipt.paymentMethod ? `<div>Payment: ${escapeHtml(receipt.paymentMethod.toUpperCase())}</div>` : ""}
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
        ${
          receipt.discount && receipt.discount > 0
            ? `<tr><td>Discount</td><td class="right">-${formatInr(receipt.discount)}</td></tr>`
            : ""
        }
        ${
          receipt.tax && receipt.tax > 0
            ? `<tr><td>Tax</td><td class="right">${formatInr(receipt.tax)}</td></tr>`
            : ""
        }
        <tr>
          <td class="total">TOTAL</td>
          <td class="total right">${formatInr(receipt.total)}</td>
        </tr>
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
