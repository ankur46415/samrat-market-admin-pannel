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
    return await Promise.race([
      new Promise<string | null>((res) => {
        const reader = new FileReader()
        reader.onloadend = () => res(typeof reader.result === "string" ? reader.result : null)
        reader.onerror = () => res(null)
        reader.readAsDataURL(blob)
      }),
      new Promise<null>((res) => {
        window.setTimeout(() => res(null), 2500)
      }),
    ])
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

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

/** html2canvas cannot parse Tailwind v4 oklch() — render inside a blank iframe. */
async function htmlToCanvasIsolated(innerHtml: string, widthPx = 794): Promise<HTMLCanvasElement> {
  const iframe = document.createElement("iframe")
  iframe.setAttribute("aria-hidden", "true")
  iframe.style.cssText = `position:fixed;left:-14000px;top:0;width:${widthPx}px;height:1px;border:0;opacity:0;pointer-events:none;`
  const srcdoc = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Sans+Devanagari:wght@400;700&display=swap" />
  <style>
    html, body { margin: 0; padding: 0; background: #ffffff; }
    body { width: ${widthPx}px; }
  </style>
</head>
<body>${innerHtml}</body>
</html>`
  document.body.appendChild(iframe)
  iframe.srcdoc = srcdoc

  await new Promise<void>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error("Hindi PDF frame timed out")), 10000)
    const finish = () => {
      window.clearTimeout(timer)
      resolve()
    }
    iframe.onload = () => finish()
  })

  const frameDoc = iframe.contentDocument
  const root = frameDoc?.body.firstElementChild as HTMLElement | null
  if (!frameDoc || !root) {
    iframe.remove()
    throw new Error("Hindi PDF frame failed")
  }

  iframe.style.height = `${Math.max(root.scrollHeight, 400)}px`
  try {
    await frameDoc.fonts.ready
  } catch {
    // system Devanagari fonts still work
  }

  const html2canvas = (await import("html2canvas")).default
  try {
    return await html2canvas(root, {
      scale: 2,
      backgroundColor: "#ffffff",
      useCORS: true,
      windowWidth: widthPx,
      onclone: (clonedDoc) => {
        clonedDoc.querySelectorAll("style, link[rel='stylesheet']").forEach((node) => {
          const href = (node as HTMLLinkElement).href || ""
          if (href.includes("fonts.googleapis.com")) return
          node.remove()
        })
      },
    })
  } finally {
    iframe.remove()
  }
}

async function downloadOrderPdfHindi(
  group: Pick<OrderMgmtGroup, "name" | "source">,
  order: OrderMgmtOrder,
  cols: typeof ORDER_TABLE_COLUMNS
): Promise<void> {
  const logoDataUrl = await loadLogoDataUrl()
  const status = order.status === "delivered" ? "डिलीवर्ड" : "पेंडिंग"
  const meta = [
    `समूह: ${escapeHtml(toHindiPhonetic(group.name))}`,
    group.source ? `स्रोत: ${escapeHtml(toHindiPhonetic(group.source))}` : "",
    `स्थिति: ${status}`,
    `कुल: ${escapeHtml(formatPdfAmount(orderAmount(order)))}`,
    `आइटम्स: ${escapeHtml(formatPcsHindi(orderPieceCount(order)))}`,
  ].filter(Boolean)

  const head = cols
    .map(
      (col) =>
        `<th style="text-align:${col.numeric ? "right" : "left"};padding:8px 10px;border-bottom:1px solid #e2e8f0;background:#0f4c81;color:#ffffff;">${HINDI_COL_LABELS[col.key]}</th>`
    )
    .join("")
  const rows = order.lines
    .map((line, index) => {
      const bg = index % 2 === 1 ? "#f8faff" : "#ffffff"
      const cells = cols
        .map((col) => {
          const align = col.numeric ? "right" : "left"
          return `<td style="text-align:${align};padding:8px 10px;border-bottom:1px solid #e2e8f0;background:${bg};color:#1b1b1f;">${escapeHtml(lineCell(col.key, line, index, "hi"))}</td>`
        })
        .join("")
      return `<tr>${cells}</tr>`
    })
    .join("")

  const innerHtml = `
    <div style="width:794px;box-sizing:border-box;background:#ffffff;font-family:'Noto Sans Devanagari','Nirmala UI',Mangal,sans-serif;color:#1b1b1f;">
      <div style="background:#0f4c81;color:#ffffff;padding:18px 28px 16px;display:flex;align-items:center;gap:16px;">
        ${logoDataUrl ? `<img src="${logoDataUrl}" width="48" height="48" alt="" />` : ""}
        <div>
          <div style="font-size:22px;font-weight:700;color:#ffffff;">सम्राट मार्केट</div>
          <div style="font-size:13px;color:#bfdbfe;margin-top:2px;">ऑर्डर मैनेजमेंट</div>
        </div>
      </div>
      <div style="height:6px;background:#2563eb;"></div>
      <div style="padding:22px 28px 28px;background:#ffffff;">
        <div style="font-size:18px;font-weight:700;color:#1b1b1f;">ऑर्डर ${escapeHtml(order.id)}</div>
        <div style="font-size:12px;color:#475569;margin-top:8px;line-height:1.5;">${meta.join(" &nbsp;|&nbsp; ")}</div>
        <table style="width:100%;border-collapse:collapse;margin-top:16px;font-size:13px;color:#1b1b1f;">
          <thead>
            <tr>${head}</tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>
  `

  const canvas = await htmlToCanvasIsolated(innerHtml)
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const margin = 8
  const imgW = pageW - margin * 2
  const pxPerPage = Math.floor(((pageH - margin * 2) * canvas.width) / imgW)
  let srcY = 0
  let page = 0
  while (srcY < canvas.height) {
    if (page > 0) doc.addPage()
    const sliceH = Math.min(canvas.height - srcY, pxPerPage)
    const slice = document.createElement("canvas")
    slice.width = canvas.width
    slice.height = sliceH
    const ctx = slice.getContext("2d")
    if (!ctx) throw new Error("PDF canvas failed")
    ctx.fillStyle = "#ffffff"
    ctx.fillRect(0, 0, slice.width, slice.height)
    ctx.drawImage(canvas, 0, srcY, canvas.width, sliceH, 0, 0, canvas.width, sliceH)
    const hMm = (sliceH * imgW) / canvas.width
    doc.addImage(slice.toDataURL("image/jpeg", 0.92), "JPEG", margin, margin, imgW, hMm)
    srcY += sliceH
    page++
  }
  doc.save(`Order_${order.id}_Hindi.pdf`)
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
  const headers = cols.map((col) => col.label)
  const body = order.lines.map((line, index) => cols.map((col) => lineCell(col.key, line, index, "en")))

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
  doc.text(meta.join("  |  "), 14, 57)

  autoTable(doc, {
    startY: 64,
    head: [headers],
    body,
    styles: { fontSize: 9, cellPadding: 2.5, textColor: [27, 27, 31] },
    headStyles: { fillColor: [15, 76, 129], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [248, 250, 255] },
    columnStyles: Object.fromEntries(
      cols.map((col, i) => [
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
