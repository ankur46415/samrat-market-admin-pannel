import { jsPDF } from "jspdf"
import autoTable from "jspdf-autotable"
import type { PaymentLedgerEntry, PaymentPayee } from "./models"
import { payeePaymentsTotal, payeePurchasesTotal, payeeRemaining } from "./models"

const NAVY: [number, number, number] = [15, 76, 129]
const BLUE: [number, number, number] = [37, 99, 235]
const LIGHT: [number, number, number] = [239, 246, 255]
const CARD_BORDER: [number, number, number] = [147, 197, 253]
const ROW_ALT: [number, number, number] = [248, 250, 255]
const MUTED: [number, number, number] = [71, 85, 105]

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

function remainingStatus(remaining: number): string {
  if (remaining > 0.009) return "Due"
  if (remaining < -0.009) return "Advance"
  return "Settled"
}

function reportDate(): string {
  return new Date().toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

async function loadLogoDataUrl(): Promise<string | null> {
  try {
    const resp = await fetch("/images/samrat-market-logo.png")
    if (!resp.ok) return null
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

function drawBlueHeader(doc: jsPDF, subtitle: string, logoDataUrl: string | null) {
  const pageW = doc.internal.pageSize.getWidth()
  doc.setFillColor(...NAVY)
  doc.rect(0, 0, pageW, 36, "F")
  doc.setFillColor(...BLUE)
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
  doc.text(pdfSafe(subtitle), textX, 24)
  doc.setFontSize(8)
  doc.text(reportDate(), pageW - 14, 22, { align: "right" })
}

function drawSummaryCards(
  doc: jsPDF,
  y: number,
  purchases: number,
  paid: number,
  remaining: number
): number {
  const pageW = doc.internal.pageSize.getWidth()
  const gap = 5
  const cardW = (pageW - 28 - gap * 2) / 3
  const cardH = 28
  const cards: { label: string; value: number; accent: [number, number, number] }[] = [
    { label: "Purchases", value: purchases, accent: BLUE },
    { label: "Paid", value: paid, accent: [14, 165, 233] },
    { label: "Remaining", value: remaining, accent: NAVY },
  ]

  cards.forEach((card, i) => {
    const x = 14 + i * (cardW + gap)
    doc.setFillColor(...LIGHT)
    doc.setDrawColor(...CARD_BORDER)
    doc.setLineWidth(0.4)
    doc.roundedRect(x, y, cardW, cardH, 2.5, 2.5, "FD")
    doc.setFillColor(...card.accent)
    doc.rect(x, y, 2.2, cardH, "F")
    doc.setFont("helvetica", "normal")
    doc.setFontSize(8)
    doc.setTextColor(...MUTED)
    doc.text(card.label.toUpperCase(), x + 8, y + 9)
    doc.setFont("helvetica", "bold")
    doc.setFontSize(12)
    doc.setTextColor(...NAVY)
    const display = card.label === "Remaining" ? Math.abs(card.value) : card.value
    doc.text(pdfSafe(formatPdfAmount(display)), x + 8, y + 19)
    if (card.label === "Remaining") {
      doc.setFont("helvetica", "normal")
      doc.setFontSize(7)
      doc.setTextColor(...BLUE)
      doc.text(remainingStatus(remaining), x + 8, y + 25)
    }
  })

  return y + cardH
}

function drawFooters(doc: jsPDF, logoDataUrl: string | null, footerLabel: string) {
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const totalPages = doc.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    doc.setFillColor(...NAVY)
    doc.rect(0, pageH - 14, pageW, 14, "F")
    if (logoDataUrl) {
      try {
        doc.addImage(logoDataUrl, "PNG", 12, pageH - 12, 8, 8)
      } catch {
        // skip
      }
    }
    doc.setFont("helvetica", "normal")
    doc.setFontSize(7)
    doc.setTextColor(191, 219, 254)
    doc.text(pdfSafe(footerLabel), pageW / 2, pageH - 6, { align: "center" })
    doc.setTextColor(255, 255, 255)
    doc.text(`Page ${i} of ${totalPages}`, pageW - 12, pageH - 6, { align: "right" })
  }
}

export async function downloadPayeeStatementPdf(
  payee: PaymentPayee,
  entries: PaymentLedgerEntry[]
): Promise<void> {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" })
  const logoDataUrl = await loadLogoDataUrl()
  const purchases = payeePurchasesTotal(entries)
  const paid = payeePaymentsTotal(entries)
  const remaining = payeeRemaining(entries)

  const chronological = [...entries].sort(
    (a, b) => a.date.getTime() - b.date.getTime() || a.createdAt.getTime() - b.createdAt.getTime()
  )

  let running = 0
  const body = chronological.map((entry, idx) => {
    running += entry.type === "purchase" ? entry.amount : -entry.amount
    const signed =
      entry.type === "purchase" ? `+ ${formatPdfAmount(entry.amount)}` : `- ${formatPdfAmount(entry.amount)}`
    return [
      String(idx + 1),
      entry.date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }),
      entry.type === "purchase" ? "Purchase" : "Payment",
      pdfSafe(entry.notes || "-"),
      pdfSafe(signed),
      pdfSafe(formatPdfAmount(running)),
    ]
  })

  drawBlueHeader(doc, "Payment statement", logoDataUrl)

  doc.setFont("helvetica", "bold")
  doc.setFontSize(16)
  doc.setTextColor(...NAVY)
  doc.text(pdfSafe(payee.name), 14, 50)

  doc.setFont("helvetica", "normal")
  doc.setFontSize(9)
  doc.setTextColor(...MUTED)
  const meta = [payee.phone || "No phone", payee.notes ? pdfSafe(payee.notes) : null].filter(Boolean).join("  |  ")
  doc.text(meta, 14, 56)

  const afterCards = drawSummaryCards(doc, 62, purchases, paid, remaining)

  autoTable(doc, {
    startY: afterCards + 8,
    head: [["#", "Date", "Type", "Notes / Order", "Amount", "Balance"]],
    body: body.length > 0 ? body : [["-", "-", "-", "No transactions yet", "-", "-"]],
    styles: {
      fontSize: 8,
      cellPadding: 2.4,
      lineColor: [191, 219, 254],
      lineWidth: 0.2,
      textColor: [15, 23, 42],
    },
    headStyles: {
      fillColor: BLUE,
      textColor: 255,
      fontStyle: "bold",
      fontSize: 9,
    },
    alternateRowStyles: { fillColor: ROW_ALT },
    columnStyles: {
      0: { halign: "center", cellWidth: 10 },
      1: { cellWidth: 28 },
      2: { cellWidth: 24 },
      4: { halign: "right", cellWidth: 32 },
      5: { halign: "right", cellWidth: 30, fontStyle: "bold", textColor: NAVY },
    },
    margin: { left: 14, right: 14, bottom: 20 },
    didParseCell: (data) => {
      if (data.section !== "body") return
      const type = String(data.row.raw?.[2] ?? "")
      const purchaseRed: [number, number, number] = [185, 28, 28]
      const paymentGreen: [number, number, number] = [22, 163, 74]
      if (data.column.index === 2 || data.column.index === 4) {
        if (type === "Purchase") {
          data.cell.styles.textColor = purchaseRed
          data.cell.styles.fontStyle = "bold"
        }
        if (type === "Payment") {
          data.cell.styles.textColor = paymentGreen
          data.cell.styles.fontStyle = "bold"
        }
      }
    },
  })

  drawFooters(doc, logoDataUrl, "Samrat Market | Payment Management")
  doc.save(`Samrat_Payments_${safeFileName(payee.name)}_${new Date().toISOString().slice(0, 10)}.pdf`)
}

export async function downloadPaymentOverviewPdf(
  rows: Array<{
    payee: PaymentPayee
    purchases: number
    paid: number
    remaining: number
  }>,
  totals: { purchases: number; paid: number; remaining: number }
): Promise<void> {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" })
  const logoDataUrl = await loadLogoDataUrl()

  drawBlueHeader(doc, "Payment summary - all suppliers", logoDataUrl)

  doc.setFont("helvetica", "bold")
  doc.setFontSize(14)
  doc.setTextColor(...NAVY)
  doc.text("Account overview", 14, 50)

  const afterCards = drawSummaryCards(doc, 56, totals.purchases, totals.paid, totals.remaining)

  const sorted = [...rows].sort((a, b) => b.remaining - a.remaining || a.payee.name.localeCompare(b.payee.name))

  autoTable(doc, {
    startY: afterCards + 8,
    head: [["#", "Supplier / Payee", "Phone", "Purchases", "Paid", "Remaining", "Status"]],
    body:
      sorted.length > 0
        ? sorted.map((row, idx) => [
            String(idx + 1),
            pdfSafe(row.payee.name),
            pdfSafe(row.payee.phone || "-"),
            pdfSafe(formatPdfAmount(row.purchases)),
            pdfSafe(formatPdfAmount(row.paid)),
            pdfSafe(formatPdfAmount(Math.abs(row.remaining))),
            remainingStatus(row.remaining),
          ])
        : [["-", "No payees yet", "-", "-", "-", "-", "-"]],
    styles: {
      fontSize: 8,
      cellPadding: 2.4,
      lineColor: [191, 219, 254],
      lineWidth: 0.2,
      textColor: [15, 23, 42],
    },
    headStyles: {
      fillColor: BLUE,
      textColor: 255,
      fontStyle: "bold",
      fontSize: 9,
    },
    alternateRowStyles: { fillColor: ROW_ALT },
    columnStyles: {
      0: { halign: "center", cellWidth: 10 },
      3: { halign: "right" },
      4: { halign: "right" },
      5: { halign: "right", fontStyle: "bold", textColor: NAVY },
      6: { halign: "center" },
    },
    margin: { left: 14, right: 14, bottom: 20 },
  })

  drawFooters(doc, logoDataUrl, "Samrat Market | Payment Management")
  doc.save(`Samrat_Payment_Summary_${new Date().toISOString().slice(0, 10)}.pdf`)
}
