import { jsPDF } from "jspdf"
import autoTable from "jspdf-autotable"
import type { PurchaseCatalog } from "./models"

/** jsPDF default font (Helvetica) does not support ₹, •, ×, em-dash — use ASCII-safe text */
function pdfSafe(text: string): string {
  return text
    .replace(/₹/g, "Rs.")
    .replace(/[\u2013\u2014—]/g, "-")
    .replace(/×/g, "x")
    .replace(/•/g, "|")
}

function formatPdfPrice(amount: number): string {
  return `Rs. ${amount.toLocaleString("en-IN")}`
}

async function loadLogoDataUrl(): Promise<string | null> {
  try {
    const resp = await fetch("/images/samrat-market-logo.png")
    const blob = await resp.blob()
    return await new Promise<string>((res) => {
      const reader = new FileReader()
      reader.onloadend = () => res(reader.result as string)
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

function safeFileName(name: string): string {
  return name.replace(/[^\w\s-]/g, "").replace(/\s+/g, "_").slice(0, 60)
}

/** Download PDF for a single catalog group with all its products */
export async function downloadCatalogGroupPdf(catalog: PurchaseCatalog): Promise<void> {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()

  const logoDataUrl = await loadLogoDataUrl()

  const logoH = 16
  if (logoDataUrl) {
    doc.addImage(logoDataUrl, "PNG", 14, 8, logoH, logoH)
  }

  const textX = logoDataUrl ? 14 + logoH + 4 : 14
  doc.setFontSize(22)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(27, 27, 31)
  doc.text("Samrat Market", textX, 17)

  doc.setFontSize(10)
  doc.setFont("helvetica", "normal")
  doc.setTextColor(100)
  doc.text("Purchase Catalog", textX, 23)

  doc.setDrawColor(200)
  doc.setLineWidth(0.4)
  doc.line(14, 28, pageW - 14, 28)

  doc.setFontSize(14)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(39, 39, 42)
  doc.text(pdfSafe(catalog.name), 14, 37)

  doc.setFontSize(9)
  doc.setFont("helvetica", "normal")
  doc.setTextColor(120)
  const dateStr = new Date().toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
  const metaParts = [
    catalog.source ? `Source: ${pdfSafe(catalog.source)}` : null,
    `${catalog.products.length} products`,
    dateStr,
  ].filter(Boolean)
  doc.text(pdfSafe(metaParts.join("  |  ")), 14, 43)
  doc.setTextColor(0)

  const totalMoqValue = catalog.products.reduce((sum, p) => sum + p.price * p.moq, 0)

  autoTable(doc, {
    startY: 49,
    head: [["#", "Product Name", "Brand", "Price", "MOQ", "Unit", "MOQ Value"]],
    body: catalog.products.map((p, idx) => [
      idx + 1,
      pdfSafe(p.product_name),
      pdfSafe(p.brand ?? "-"),
      formatPdfPrice(p.price),
      String(p.moq),
      pdfSafe(p.unit ?? "-"),
      formatPdfPrice(p.price * p.moq),
    ]),
    styles: { fontSize: 9, cellPadding: 3, lineColor: [220, 220, 220], lineWidth: 0.2 },
    headStyles: {
      fillColor: [99, 102, 241],
      textColor: 255,
      fontStyle: "bold",
      fontSize: 9,
    },
    columnStyles: {
      0: { halign: "center", cellWidth: 10 },
      1: { cellWidth: 55 },
      3: { halign: "right", cellWidth: 22 },
      4: { halign: "center", cellWidth: 14 },
      6: { halign: "right", cellWidth: 24 },
    },
    alternateRowStyles: { fillColor: [248, 248, 250] },
    margin: { left: 14, right: 14 },
  })

  const tableEndY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6
  if (tableEndY < pageH - 30) {
    doc.setFontSize(10)
    doc.setFont("helvetica", "bold")
    doc.text(
      pdfSafe(`Total MOQ x Price: ${formatPdfPrice(totalMoqValue)}`),
      pageW - 14,
      tableEndY,
      { align: "right" }
    )
  }

  const totalPages = doc.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    doc.setDrawColor(210)
    doc.setLineWidth(0.3)
    doc.line(14, pageH - 20, pageW - 14, pageH - 20)

    if (logoDataUrl) {
      const logoSize = 10
      doc.addImage(logoDataUrl, "PNG", (pageW - logoSize) / 2, pageH - 18, logoSize, logoSize)
    }

    doc.setFontSize(7)
    doc.setTextColor(160)
    doc.text("Samrat Market | Purchase Catalog", pageW / 2, pageH - 6, { align: "center" })
    doc.text(`Page ${i} of ${totalPages}`, pageW - 14, pageH - 6, { align: "right" })
  }

  const fileName = `Samrat_Purchase_${safeFileName(catalog.name)}_${new Date().toISOString().slice(0, 10)}.pdf`
  doc.save(fileName)
}
