import { jsPDF } from "jspdf"
import autoTable from "jspdf-autotable"
import type { OrderMgmtGroup, OrderMgmtOrder, OrderTableColumn } from "./models"
import { ORDER_TABLE_COLUMNS, formatPcs, orderAmount, orderPieceCount } from "./models"
import { formatPcsHindi, toHindiPhonetic } from "./hindi-phonetic"

export type OrderPdfScript = "en" | "hi"

const HINDI_COL_LABELS: Record<OrderTableColumn, string> = {
  id: "आईडी",
  name: "नाम",
  brand: "ब्रांड",
  buyRate: "खरीद दर",
  saleRate: "बिक्री दर",
  qty: "मात्रा",
  total: "कुल",
}

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

function safePdfFileName(orderId: string, hindi: boolean): string {
  const id = String(orderId).replace(/[^\w.-]+/g, "_")
  return hindi ? `Order_${id}_Hindi.pdf` : `Order_${id}.pdf`
}

async function loadLogoDataUrl(): Promise<string | null> {
  try {
    const ctrl = new AbortController()
    const timer = window.setTimeout(() => ctrl.abort(), 1200)
    const resp = await fetch("/images/samrat-market-logo.png", { signal: ctrl.signal })
    window.clearTimeout(timer)
    if (!resp.ok) return null
    const blob = await resp.blob()
    return await new Promise<string | null>((res) => {
      const reader = new FileReader()
      const done = (value: string | null) => res(value)
      reader.onloadend = () => done(typeof reader.result === "string" ? reader.result : null)
      reader.onerror = () => done(null)
      reader.readAsDataURL(blob)
      window.setTimeout(() => done(null), 1200)
    })
  } catch {
    return null
  }
}

function lineCell(
  col: OrderTableColumn,
  line: OrderMgmtOrder["lines"][number],
  index: number,
  script: OrderPdfScript
): string {
  switch (col) {
    case "id":
      return String(index + 1)
    case "name":
      return script === "hi" ? toHindiPhonetic(line.name) : pdfSafe(line.name)
    case "brand":
      return script === "hi" ? toHindiPhonetic(line.brand || "-") : pdfSafe(line.brand || "-")
    case "buyRate":
      return formatPdfAmount(line.buyRate)
    case "saleRate":
      return formatPdfAmount(line.saleRate)
    case "qty":
      return script === "hi" ? formatPcsHindi(line.qty) : formatPcs(line.qty)
    case "total":
      return formatPdfAmount(line.total)
  }
}

function applyAutoTable(
  doc: jsPDF,
  opts: Parameters<typeof autoTable>[1]
): void {
  const fn =
    typeof autoTable === "function"
      ? autoTable
      : ((autoTable as { default?: typeof autoTable }).default as typeof autoTable | undefined)
  if (typeof fn !== "function") {
    throw new Error("PDF table plugin failed to load")
  }
  fn(doc, opts)
}

async function downloadOrderPdfEnglish(
  group: Pick<OrderMgmtGroup, "name" | "source">,
  order: OrderMgmtOrder,
  cols: typeof ORDER_TABLE_COLUMNS
): Promise<void> {
  const headers = cols.map((col) => col.label)
  const body =
    order.lines.length === 0
      ? [cols.map((col) => (col.key === "name" ? "No items" : ""))]
      : order.lines.map((line, index) => cols.map((col) => lineCell(col.key, line, index, "en")))

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
    columnStyles: Object.fromEntries(
      cols.map((col, i) => [i, { halign: col.numeric ? "right" : "left" }])
    ),
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

  doc.save(safePdfFileName(order.id, false))
}

function wrapCanvasText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = String(text || "").split(/\s+/).filter(Boolean)
  if (words.length === 0) return [""]
  const lines: string[] = []
  let current = words[0]
  for (let i = 1; i < words.length; i++) {
    const trial = `${current} ${words[i]}`
    if (ctx.measureText(trial).width <= maxWidth) current = trial
    else {
      lines.push(current)
      current = words[i]
    }
  }
  lines.push(current)
  return lines
}

async function downloadOrderPdfHindi(
  group: Pick<OrderMgmtGroup, "name" | "source">,
  order: OrderMgmtOrder,
  cols: typeof ORDER_TABLE_COLUMNS
): Promise<void> {
  const scale = 2
  const pageW = 794
  const pageH = 1123
  const margin = 36
  const innerW = pageW - margin * 2
  const font = `"Nirmala UI","Noto Sans Devanagari",Mangal,sans-serif`
  const logoDataUrl = await loadLogoDataUrl()

  const headerH = 88
  const colW = cols.map((col) => {
    if (col.key === "id") return 48
    if (col.key === "qty") return 80
    if (col.numeric) return 110
    if (col.key === "name") return 0
    return 100
  })
  const named = cols.findIndex((c) => c.key === "name")
  const used = colW.reduce((s, w, i) => (i === named ? s : s + w), 0)
  if (named >= 0) colW[named] = Math.max(120, innerW - used)
  else if (colW.length) {
    const extra = innerW - colW.reduce((s, w) => s + w, 0)
    colW[0] += extra
  }

  const rows = order.lines.map((line, index) => cols.map((col) => lineCell(col.key, line, index, "hi")))
  const status = order.status === "delivered" ? "डिलीवर्ड" : "पेंडिंग"
  const meta = [
    `समूह: ${toHindiPhonetic(group.name)}`,
    group.source ? `स्रोत: ${toHindiPhonetic(group.source)}` : "",
    `स्थिति: ${status}`,
    `कुल: ${formatPdfAmount(orderAmount(order))}`,
    `आइटम्स: ${formatPcsHindi(orderPieceCount(order))}`,
  ].filter(Boolean)

  const measure = document.createElement("canvas")
  const mctx = measure.getContext("2d")
  if (!mctx) throw new Error("PDF canvas failed")
  mctx.font = `13px ${font}`

  const rowHeights = rows.map((cells) => {
    let h = 28
    cells.forEach((cell, i) => {
      const lines = wrapCanvasText(mctx, cell, Math.max(24, colW[i] - 16))
      h = Math.max(h, 16 + lines.length * 16)
    })
    return h
  })

  const pages: HTMLCanvasElement[] = []
  let rowIndex = 0
  while (rowIndex < rows.length || pages.length === 0) {
    const canvas = document.createElement("canvas")
    canvas.width = pageW * scale
    canvas.height = pageH * scale
    const ctx = canvas.getContext("2d")
    if (!ctx) throw new Error("PDF canvas failed")
    ctx.scale(scale, scale)
    ctx.fillStyle = "#ffffff"
    ctx.fillRect(0, 0, pageW, pageH)

    ctx.fillStyle = "#0f4c81"
    ctx.fillRect(0, 0, pageW, 72)
    ctx.fillStyle = "#2563eb"
    ctx.fillRect(0, 72, pageW, 6)

    if (logoDataUrl) {
      try {
        const img = await new Promise<HTMLImageElement | null>((resolve) => {
          const image = new Image()
          image.onload = () => resolve(image)
          image.onerror = () => resolve(null)
          image.src = logoDataUrl
        })
        if (img) ctx.drawImage(img, 28, 14, 44, 44)
      } catch {
        // skip logo
      }
    }

    const titleX = logoDataUrl ? 84 : 28
    ctx.fillStyle = "#ffffff"
    ctx.font = `700 22px ${font}`
    ctx.fillText("सम्राट मार्केट", titleX, 34)
    ctx.font = `13px ${font}`
    ctx.fillStyle = "#bfdbfe"
    ctx.fillText("ऑर्डर मैनेजमेंट", titleX, 54)

    let y = headerH
    ctx.fillStyle = "#1b1b1f"
    ctx.font = `700 18px ${font}`
    ctx.fillText(`ऑर्डर ${order.id}`, margin, y)
    y += 22
    ctx.font = `12px ${font}`
    ctx.fillStyle = "#475569"
    wrapCanvasText(ctx, meta.join("  |  "), innerW).forEach((line) => {
      ctx.fillText(line, margin, y)
      y += 16
    })
    y += 10

    const drawHeader = () => {
      ctx.fillStyle = "#0f4c81"
      ctx.fillRect(margin, y, innerW, 28)
      ctx.fillStyle = "#ffffff"
      ctx.font = `700 12px ${font}`
      let x = margin
      cols.forEach((col, i) => {
        const label = HINDI_COL_LABELS[col.key]
        if (col.numeric) {
          ctx.textAlign = "right"
          ctx.fillText(label, x + colW[i] - 8, y + 19)
        } else {
          ctx.textAlign = "left"
          ctx.fillText(label, x + 8, y + 19)
        }
        x += colW[i]
      })
      ctx.textAlign = "left"
      y += 28
    }
    drawHeader()

    let drew = 0
    while (rowIndex < rows.length) {
      const h = rowHeights[rowIndex]
      if (drew > 0 && y + h > pageH - 40) break
      ctx.fillStyle = rowIndex % 2 === 1 ? "#f8faff" : "#ffffff"
      ctx.fillRect(margin, y, innerW, h)
      ctx.strokeStyle = "#e2e8f0"
      ctx.beginPath()
      ctx.moveTo(margin, y + h)
      ctx.lineTo(margin + innerW, y + h)
      ctx.stroke()
      ctx.fillStyle = "#1b1b1f"
      ctx.font = `13px ${font}`
      let x = margin
      rows[rowIndex].forEach((cell, i) => {
        const lines = wrapCanvasText(ctx, cell, Math.max(24, colW[i] - 16))
        lines.forEach((line, li) => {
          const ty = y + 18 + li * 16
          if (cols[i].numeric) {
            ctx.textAlign = "right"
            ctx.fillText(line, x + colW[i] - 8, ty)
          } else {
            ctx.textAlign = "left"
            ctx.fillText(line, x + 8, ty)
          }
        })
        x += colW[i]
      })
      ctx.textAlign = "left"
      y += h
      rowIndex++
      drew++
    }

    ctx.fillStyle = "#777777"
    ctx.font = `11px ${font}`
    ctx.textAlign = "center"
    ctx.fillText("सम्राट मार्केट | ऑर्डर मैनेजमेंट", pageW / 2, pageH - 18)
    ctx.textAlign = "left"
    pages.push(canvas)
    if (rows.length === 0) break
  }

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" })
  const pdfW = doc.internal.pageSize.getWidth()
  const pdfH = doc.internal.pageSize.getHeight()
  pages.forEach((canvas, i) => {
    if (i > 0) doc.addPage()
    doc.addImage(canvas.toDataURL("image/jpeg", 0.92), "JPEG", 0, 0, pdfW, pdfH)
  })
  doc.save(safePdfFileName(order.id, true))
}

export async function downloadOrderPdf(
  group: Pick<OrderMgmtGroup, "name" | "source">,
  order: OrderMgmtOrder,
  visibleColumns: OrderTableColumn[],
  script: OrderPdfScript = "en"
): Promise<void> {
  const columns = ORDER_TABLE_COLUMNS.filter((col) => visibleColumns.includes(col.key))
  const cols = columns.length ? columns : ORDER_TABLE_COLUMNS
  if (script === "hi") {
    await downloadOrderPdfHindi(group, order, cols)
    return
  }
  await downloadOrderPdfEnglish(group, order, cols)
}
