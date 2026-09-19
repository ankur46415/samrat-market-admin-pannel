import { jsPDF } from "jspdf"
import autoTable from "jspdf-autotable"
import type { OrderMgmtGroup, OrderMgmtOrder, OrderTableColumn } from "./models"
import { ORDER_TABLE_COLUMNS, orderAmount } from "./models"

function pdfSafe(text: string): string {
  return text
    .replace(/₹/g, "Rs.")
    .replace(/[\u2013\u2014—]/g, "-")
    .replace(/×/g, "x")
    .replace(/•/g, "|")
}

function formatPdfAmount(amount: number): string {
  return `Rs. ${amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

async function loadLogoDataUrl(): Promise<string | null> {
  try {
    const resp = await fetch("/images/samrat-market-logo.png")
    if (!resp.ok) return null
    const blob = await resp.blob()
    return await new Promise<string>((res) => {
      const reader = new FileReader()
      reader.onloadend = () => res(reader.result as string)
    })
  } catch {
    return null
  }
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
      return String(line.qty)
    case "total":
      return formatPdfAmount(line.total)
  }
}

export async function downloadOrderPdf(
  group: Pick<OrderMgmtGroup, "name" | "source">,
  order: OrderMgmtOrder,
  visibleColumns: OrderTableColumn[]
): Promise<void> {
  const columns = ORDER_TABLE_COLUMNS.filter((col) => visibleColumns.includes(col.key))
  const headers = (columns.length ? columns : ORDER_TABLE_COLUMNS).map((col) => col.label)
  const body = order.lines.map((line, index) =>
    (columns.length ? columns : ORDER_TABLE_COLUMNS).map((col) => lineCell(col.key, line, index))
  )

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const logoDataUrl = await loadLogoDataUrl()

  doc.setFillColor(15, 76, 129)
  doc.rect(0, 0, pageW, 36, "F")
  doc.setFillColor(37, 99, 235)
  doc.rect(0, 36, pageW, 3, "F")

  if (logoDataUrl) {
    try {
      doc.addImage(logoDataUrl, "PNG", 14, 8, 20, 20)
    } catch {
      // skip broken logo
    }
  }

  const textX = logoDataUrl ? 38 : 14
  doc.setFont("helvetica", "bold")
  doc.setFontSize(18)
  doc.setTextColor(255, 255, 255)
  doc.text("Samrat Market", textX, 16)
  doc.setFont("helvetica", "normal")
  doc.setFontSize(10)
  doc.setTextColor(191, 219, 254)
  doc.text("Order Management", textX, 24)

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
    `Items: ${order.lines.length}`,
  ].filter(Boolean)
  doc.text(meta.join("  |  "), 14, 57)

  autoTable(doc, {
    startY: 64,
    head: [headers],
    body,
    styles: { fontSize: 9, cellPadding: 2.5, textColor: [27, 27, 31] },
    headStyles: { fillColor: [15, 76, 129], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [248, 250, 255] },
    columnStyles: Object.fromEntries(
      (columns.length ? columns : ORDER_TABLE_COLUMNS).map((col, i) => [
        i,
        { halign: col.numeric ? "right" : "left" },
      ])
    ),
    margin: { left: 14, right: 14 },
  })

  const pageCount = doc.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFontSize(8)
    doc.setTextColor(120)
    doc.text("Samrat Market | Order Management", pageW / 2, pageH - 8, { align: "center" })
    doc.text(`Page ${i} of ${pageCount}`, pageW - 14, pageH - 8, { align: "right" })
  }

  doc.save(`Order_${order.id}.pdf`)
}
