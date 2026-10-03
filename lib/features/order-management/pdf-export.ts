import { jsPDF } from "jspdf"
import autoTable from "jspdf-autotable"
import type { OrderMgmtGroup, OrderMgmtOrder, OrderTableColumn } from "./models"
import { ORDER_TABLE_COLUMNS, formatPcs, orderAmount, orderPieceCount } from "./models"

function pdfSafe(text: string): string {
  return Array.from(String(text ?? ""))
    .map((ch) => {
      if (ch === "₹") return "Rs."
      if (ch === "–" || ch === "—" || ch === "−") return "-"
      if (ch === "×") return "x"
      if (ch === "•") return "|"
      const code = ch.codePointAt(0) ?? 0
      if (code < 32) return " "
      if (code <= 255) return ch
      return "?"
    })
    .join("")
}

function formatPdfAmount(amount: number): string {
  return `Rs. ${amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function safePdfFileName(orderId: string): string {
  const id = String(orderId).replace(/[^\w.-]+/g, "_")
  return `Order_${id}.pdf`
}

function saveJsPdf(doc: jsPDF, filename: string): void {
  const blob = doc.output("blob")
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  link.rel = "noopener"
  link.style.display = "none"
  document.body.appendChild(link)
  link.click()
  window.setTimeout(() => {
    URL.revokeObjectURL(url)
    link.remove()
  }, 1500)
}

function lineCell(col: OrderTableColumn, line: OrderMgmtOrder["lines"][number], index: number): string {
  switch (col) {
    case "id":
      return String(index + 1)
    case "name":
      return pdfSafe(line.name)
    case "brand":
      return pdfSafe(line.brand || "-")
    case "buyRate":
      return formatPdfAmount(line.buyRate)
    case "saleRate":
      return formatPdfAmount(line.saleRate)
    case "qty":
      return formatPcs(line.qty)
    case "total":
      return formatPdfAmount(line.total)
  }
}

function applyAutoTable(doc: jsPDF, opts: Parameters<typeof autoTable>[1]): void {
  const fn =
    typeof autoTable === "function"
      ? autoTable
      : ((autoTable as { default?: typeof autoTable }).default as typeof autoTable | undefined)
  if (typeof fn !== "function") {
    throw new Error("PDF table plugin failed to load")
  }
  fn(doc, opts)
}

export function downloadOrderPdf(
  group: Pick<OrderMgmtGroup, "name" | "source">,
  order: OrderMgmtOrder,
  visibleColumns: OrderTableColumn[]
): void {
  const columns = ORDER_TABLE_COLUMNS.filter((col) => visibleColumns.includes(col.key))
  const cols = columns.length ? columns : ORDER_TABLE_COLUMNS
  const headers = cols.map((col) => col.label)
  const body =
    order.lines.length === 0
      ? [cols.map((col) => (col.key === "name" ? "No items" : ""))]
      : order.lines.map((line, index) => cols.map((col) => lineCell(col.key, line, index)))

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()

  doc.setFillColor(15, 76, 129)
  doc.rect(0, 0, pageW, 36, "F")
  doc.setFillColor(37, 99, 235)
  doc.rect(0, 36, pageW, 3, "F")

  doc.setFont("helvetica", "bold")
  doc.setFontSize(18)
  doc.setTextColor(255, 255, 255)
  doc.text("Samrat Market", 14, 16)
  doc.setFont("helvetica", "normal")
  doc.setFontSize(10)
  doc.setTextColor(191, 219, 254)
  doc.text("Order Management", 14, 24)

  doc.setFont("helvetica", "bold")
  doc.setFontSize(14)
  doc.setTextColor(27, 27, 31)
  doc.text(pdfSafe(`Order ${order.id}`), 14, 50)

  doc.setFont("helvetica", "normal")
  doc.setFontSize(10)
  doc.setTextColor(71, 85, 105)
  const meta = [
    `Group: ${pdfSafe(group.name)}`,
    group.source ? `Source: ${pdfSafe(group.source)}` : "",
    `Status: ${order.status === "delivered" ? "Delivered" : "Pending"}`,
    `Total: ${formatPdfAmount(orderAmount(order))}`,
    `Items: ${formatPcs(orderPieceCount(order))}`,
  ].filter(Boolean)
  const metaLines = doc.splitTextToSize(meta.join("  |  "), pageW - 28)
  doc.text(metaLines, 14, 57)

  applyAutoTable(doc, {
    startY: 57 + metaLines.length * 5 + 4,
    head: [headers],
    body,
    styles: { fontSize: 9, cellPadding: 2.5, textColor: [27, 27, 31], overflow: "linebreak" },
    headStyles: { fillColor: [15, 76, 129], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [248, 250, 255] },
    columnStyles: Object.fromEntries(cols.map((col, i) => [i, { halign: col.numeric ? "right" : "left" }])),
    margin: { left: 14, right: 14 },
  })

  const pageCount = doc.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFont("helvetica", "normal")
    doc.setFontSize(8)
    doc.setTextColor(120)
    doc.text("Samrat Market | Order Management", pageW / 2, pageH - 8, { align: "center" })
    doc.text(`Page ${i} of ${pageCount}`, pageW - 14, pageH - 8, { align: "right" })
  }

  saveJsPdf(doc, safePdfFileName(order.id))
}
