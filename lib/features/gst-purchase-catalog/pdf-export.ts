import { jsPDF } from "jspdf"
import autoTable from "jspdf-autotable"
import type { GstPurchaseCatalog } from "./models"
import {
  catalogProductGstPercent,
  catalogProductOrderId,
  catalogProductSalePrice,
  catalogProductLineTotal,
  catalogProductOrderTag,
  gstLabel,
  gstWiseCatalogCards,
  gstWiseReportData,
  saleAmountFromMrp,
  ALL_ORDER_TAGS,
  NO_ORDER_ID,
  priceWithGst,
  resolvedOrderDiscount,
  roundMoney,
} from "./models"
import type { GstSaleRecordPercents } from "./models"

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

/** Download PDF for a catalog group (filtered products + each order's saved discount). */
export async function downloadCatalogGroupPdf(
  catalog: GstPurchaseCatalog,
  incGst = true
): Promise<void> {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" })
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
  doc.text("GST Purchase Catalog", textX, 23)

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

  const totalMoqValue = catalog.products.reduce((sum, p) => sum + catalogProductLineTotal(p, incGst), 0)
  const orderMap = new Map((catalog.orders ?? []).map((o) => [o.order_id, o]))
  const byOrder = new Map<string, number>()
  catalog.products.forEach((p) => {
    const id = catalogProductOrderId(p) || NO_ORDER_ID
    byOrder.set(id, (byOrder.get(id) ?? 0) + catalogProductLineTotal(p, incGst))
  })
  let discountAmount = 0
  const orderLines: string[] = []
  byOrder.forEach((total, id) => {
    const resolved = resolvedOrderDiscount(orderMap.get(id), total)
    discountAmount += resolved.off
    if (id !== NO_ORDER_ID && (resolved.off > 0 || resolved.percent > 0 || resolved.roundOff !== 0)) {
      const roundTxt = resolved.roundOff === 0 ? "" : ` / round ${resolved.roundOff > 0 ? "+" : ""}${formatPdfPrice(resolved.roundOff)}`
      orderLines.push(
        `${id}: ${resolved.percent}% / -${formatPdfPrice(resolved.off)}${roundTxt} / bal ${formatPdfPrice(resolved.balance)}`
      )
    }
  })
  discountAmount = roundMoney(discountAmount)
  const roundOffTotal = roundMoney(
    [...byOrder.entries()].reduce((sum, [id, total]) => {
      return sum + resolvedOrderDiscount(orderMap.get(id), total).roundOff
    }, 0)
  )
  const balance = roundMoney(totalMoqValue - discountAmount + roundOffTotal)

  autoTable(doc, {
    startY: 49,
    head: [["#", "Product Name", "Order Tag", "Order ID", "Brand", "Price", "Sale Price", "GST", "Price + GST", "MOQ", "Total", "Unit"]],
    body: catalog.products.map((p, idx) => {
      const gst = catalogProductGstPercent(p)
      const sale = catalogProductSalePrice(p)
      return [
        idx + 1,
        pdfSafe(p.product_name),
        pdfSafe(String(p.order_tag ?? "").trim() || "NA"),
        pdfSafe(catalogProductOrderId(p) || "-"),
        pdfSafe(p.brand ?? "-"),
        formatPdfPrice(p.price),
        sale != null ? formatPdfPrice(sale) : "-",
        pdfSafe(gstLabel(gst)),
        formatPdfPrice(priceWithGst(p.price, gst)),
        String(p.moq),
        formatPdfPrice(catalogProductLineTotal(p, incGst)),
        pdfSafe(p.unit ?? "-"),
      ]
    }),
    styles: { fontSize: 8, cellPadding: 2, lineColor: [220, 220, 220], lineWidth: 0.2 },
    headStyles: {
      fillColor: [13, 148, 136],
      textColor: 255,
      fontStyle: "bold",
      fontSize: 9,
    },
    columnStyles: {
      0: { halign: "center", cellWidth: 8 },
      5: { halign: "right" },
      6: { halign: "right" },
      7: { halign: "center" },
      8: { halign: "right" },
      9: { halign: "center" },
      10: { halign: "right" },
    },
    alternateRowStyles: { fillColor: [248, 248, 250] },
    margin: { left: 14, right: 14 },
  })

  const tableEndY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6
  if (tableEndY < pageH - 30) {
    doc.setFontSize(10)
    doc.setFont("helvetica", "bold")
    doc.text(
      pdfSafe(
        incGst
          ? `Total MOQ x Price: ${formatPdfPrice(totalMoqValue)}`
          : `Total (qty x rate) + GST: ${formatPdfPrice(totalMoqValue)}`
      ),
      pageW - 14,
      tableEndY,
      { align: "right" }
    )
    if (discountAmount > 0) {
      doc.setFont("helvetica", "normal")
      doc.setFontSize(8)
      orderLines.slice(0, 6).forEach((line, idx) => {
        doc.text(pdfSafe(line), pageW - 14, tableEndY + 5 + idx * 4, { align: "right" })
      })
      const extra = Math.min(orderLines.length, 6) * 4
      doc.setFontSize(10)
      doc.setFont("helvetica", "normal")
      doc.text(
        pdfSafe(`Discount: -${formatPdfPrice(discountAmount)}`),
        pageW - 14,
        tableEndY + extra + 6,
        { align: "right" }
      )
      doc.setFont("helvetica", "bold")
      doc.text(
        pdfSafe(`Balance: ${formatPdfPrice(balance)}`),
        pageW - 14,
        tableEndY + extra + 12,
        { align: "right" }
      )
    }
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
    doc.text("Samrat Market | GST Purchase Catalog", pageW / 2, pageH - 6, { align: "center" })
    doc.text(`Page ${i} of ${totalPages}`, pageW - 14, pageH - 6, { align: "right" })
  }

  const fileName = `Samrat_GST_Purchase_${safeFileName(catalog.name)}_${new Date().toISOString().slice(0, 10)}.pdf`
  doc.save(fileName)
}

function addPdfHeader(
  doc: jsPDF,
  logoDataUrl: string | null,
  subtitle: string,
  title: string,
  meta: string
) {
  const pageW = doc.internal.pageSize.getWidth()
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
  doc.text(subtitle, textX, 23)
  doc.setDrawColor(200)
  doc.setLineWidth(0.4)
  doc.line(14, 28, pageW - 14, 28)
  doc.setFontSize(14)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(39, 39, 42)
  doc.text(pdfSafe(title), 14, 37)
  doc.setFontSize(9)
  doc.setFont("helvetica", "normal")
  doc.setTextColor(120)
  doc.text(pdfSafe(meta), 14, 43)
  doc.setTextColor(0)
}

function addPdfFooter(doc: jsPDF, logoDataUrl: string | null, note: string) {
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
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
    doc.text(note, pageW / 2, pageH - 6, { align: "center" })
    doc.text(`Page ${i} of ${totalPages}`, pageW - 14, pageH - 6, { align: "right" })
  }
}

/** GST-wise full report: GST summary, then either catalog cards or the product list. */
export async function downloadGstWiseSaleReport(
  catalogs: GstPurchaseCatalog[],
  orderTag: string,
  configuredPercents: number[],
  detail: "cards" | "products" = "products"
): Promise<void> {
  const { slabs, lines } = gstWiseReportData(catalogs, orderTag, configuredPercents)
  const cards = detail === "cards" ? gstWiseCatalogCards(catalogs, orderTag, configuredPercents) : []
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" })
  const logoDataUrl = await loadLogoDataUrl()
  const dateStr = new Date().toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
  const tagLabel = orderTag === ALL_ORDER_TAGS ? "All order tags" : orderTag
  const includingGstTotal = roundMoney(slabs.reduce((sum, row) => sum + row.taxable, 0))
  const gstTotal = roundMoney(slabs.reduce((sum, row) => sum + row.gstAmount, 0))
  const taxableTotal = roundMoney(includingGstTotal - gstTotal)
  const saleTotal = roundMoney(slabs.reduce((sum, row) => sum + row.saleValue, 0))
  const subtitle = detail === "cards" ? "Card-wise GST report" : "GST-wise full report"
  const detailNote = detail === "cards"
    ? `${cards.length} catalog groups`
    : `${lines.length} products`

  addPdfHeader(
    doc,
    logoDataUrl,
    "GST Purchase Catalog",
    subtitle,
    `Order tag: ${tagLabel}  |  ${detailNote}  |  ${dateStr}`
  )

  autoTable(doc, {
    startY: 49,
    head: [["GST", "Including GST", "Taxable", "GST Amt", "MRP Sale"]],
    body: slabs.map((row) => [
      pdfSafe(row.label),
      formatPdfPrice(row.taxable),
      formatPdfPrice(roundMoney(row.taxable - row.gstAmount)),
      formatPdfPrice(row.gstAmount),
      formatPdfPrice(row.saleValue),
    ]),
    foot: [[
      "Total",
      formatPdfPrice(includingGstTotal),
      formatPdfPrice(taxableTotal),
      formatPdfPrice(gstTotal),
      formatPdfPrice(saleTotal),
    ]],
    styles: { fontSize: 8, cellPadding: 2, lineColor: [220, 220, 220], lineWidth: 0.2 },
    headStyles: { fillColor: [13, 148, 136], textColor: 255, fontStyle: "bold", fontSize: 9 },
    footStyles: { fillColor: [240, 253, 250], textColor: [15, 118, 110], fontStyle: "bold", fontSize: 8 },
    columnStyles: {
      1: { halign: "right" },
      2: { halign: "right" },
      3: { halign: "right" },
      4: { halign: "right" },
    },
    alternateRowStyles: { fillColor: [248, 248, 250] },
    margin: { left: 14, right: 14 },
  })

  let nextY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10

  if (detail === "cards") {
    doc.setFontSize(11)
    doc.setFont("helvetica", "bold")
    doc.setTextColor(39, 39, 42)
    doc.text("Catalog group details", 14, nextY)
    nextY += 3

    const cardRows = cards.flatMap((card) => {
      const gstLabels = card.slabs.map((row) => row.label).join(", ") || "-"
      return [[
        pdfSafe(card.name),
        pdfSafe(card.source || "-"),
        pdfSafe(gstLabels),
        String(card.items),
        formatPdfPrice(card.includingGst),
        formatPdfPrice(card.taxable),
        formatPdfPrice(card.gstAmount),
        formatPdfPrice(card.saleValue),
        formatPdfPrice(card.balance),
      ]]
    })

    autoTable(doc, {
      startY: nextY,
      head: [["Catalog group", "Source", "GST %", "Items", "Including GST", "Taxable", "GST Amt", "MRP Sale", "Balance"]],
      body: cardRows,
      foot: [[
        "Total",
        "",
        "",
        String(cards.reduce((sum, card) => sum + card.items, 0)),
        formatPdfPrice(roundMoney(cards.reduce((sum, card) => sum + card.includingGst, 0))),
        formatPdfPrice(roundMoney(cards.reduce((sum, card) => sum + card.taxable, 0))),
        formatPdfPrice(roundMoney(cards.reduce((sum, card) => sum + card.gstAmount, 0))),
        formatPdfPrice(roundMoney(cards.reduce((sum, card) => sum + card.saleValue, 0))),
        formatPdfPrice(roundMoney(cards.reduce((sum, card) => sum + card.balance, 0))),
      ]],
      styles: { fontSize: 7.5, cellPadding: 1.8, lineColor: [220, 220, 220], lineWidth: 0.2 },
      headStyles: { fillColor: [15, 118, 110], textColor: 255, fontStyle: "bold", fontSize: 8 },
      footStyles: { fillColor: [240, 253, 250], textColor: [15, 118, 110], fontStyle: "bold", fontSize: 7.5 },
      columnStyles: {
        3: { halign: "center" },
        4: { halign: "right" },
        5: { halign: "right" },
        6: { halign: "right" },
        7: { halign: "right" },
        8: { halign: "right" },
      },
      alternateRowStyles: { fillColor: [248, 248, 250] },
      margin: { left: 14, right: 14 },
    })

    addPdfFooter(doc, logoDataUrl, "Samrat Market | Card-wise GST report")
    const tagFile = orderTag === ALL_ORDER_TAGS ? "All_Tags" : safeFileName(orderTag)
    doc.save(`Samrat_GST_Card_Wise_${tagFile}_${new Date().toISOString().slice(0, 10)}.pdf`)
    return
  }

  doc.setFontSize(11)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(39, 39, 42)
  doc.text("Product-wise details", 14, nextY)

  autoTable(doc, {
    startY: nextY + 3,
    head: [["#", "Product", "Catalog", "Order Tag", "GST", "Qty", "Rate", "Including GST", "Taxable", "GST Amt", "MRP Sale"]],
    body: lines.map((line, idx) => {
      const p = line.product
      return [
        idx + 1,
        pdfSafe(p.product_name),
        pdfSafe(line.catalogName),
        pdfSafe(catalogProductOrderTag(p)),
        pdfSafe(gstLabel(catalogProductGstPercent(p))),
        String(p.moq),
        formatPdfPrice(p.price),
        formatPdfPrice(line.taxable),
        formatPdfPrice(roundMoney(line.taxable - line.gstAmount)),
        formatPdfPrice(line.gstAmount),
        formatPdfPrice(line.saleValue),
      ]
    }),
    styles: { fontSize: 7.5, cellPadding: 1.6, lineColor: [220, 220, 220], lineWidth: 0.2 },
    headStyles: { fillColor: [15, 118, 110], textColor: 255, fontStyle: "bold", fontSize: 8 },
    columnStyles: {
      0: { halign: "center", cellWidth: 8 },
      5: { halign: "center" },
      6: { halign: "right" },
      7: { halign: "right" },
      8: { halign: "right" },
      9: { halign: "right" },
      10: { halign: "right" },
    },
    alternateRowStyles: { fillColor: [248, 248, 250] },
    margin: { left: 14, right: 14 },
  })

  addPdfFooter(doc, logoDataUrl, "Samrat Market | GST-wise full report")
  const tagFile = orderTag === ALL_ORDER_TAGS ? "All_Tags" : safeFileName(orderTag)
  doc.save(`Samrat_GST_Full_Products_${tagFile}_${new Date().toISOString().slice(0, 10)}.pdf`)
}

export function gstReportTitle(orderTag: string): string {
  const tag = orderTag === ALL_ORDER_TAGS ? "All order tags" : orderTag
  return `Samrat Market GST report of ${tag}`
}

/** Summary PDF: GST / Including GST / Taxable (incl. GST − GST amt) / GST Amt / MRP Sale. */
export async function downloadGstWiseSummaryReport(
  catalogs: GstPurchaseCatalog[],
  orderTag: string,
  configuredPercents: number[]
): Promise<void> {
  const { slabs, lines } = gstWiseReportData(catalogs, orderTag, configuredPercents)
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" })
  const logoDataUrl = await loadLogoDataUrl()
  const dateStr = new Date().toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
  const title = gstReportTitle(orderTag)
  const includingGstTotal = roundMoney(slabs.reduce((sum, row) => sum + row.taxable, 0))
  const gstTotal = roundMoney(slabs.reduce((sum, row) => sum + row.gstAmount, 0))
  const taxableTotal = roundMoney(includingGstTotal - gstTotal)
  const saleTotal = roundMoney(slabs.reduce((sum, row) => sum + row.saleValue, 0))

  addPdfHeader(
    doc,
    logoDataUrl,
    "GST Purchase Catalog",
    title,
    `${lines.length} products  |  ${dateStr}`
  )

  autoTable(doc, {
    startY: 49,
    head: [["GST", "Including GST", "Taxable", "GST Amt", "MRP Sale"]],
    body: slabs.map((row) => [
      pdfSafe(row.label),
      formatPdfPrice(row.taxable),
      formatPdfPrice(roundMoney(row.taxable - row.gstAmount)),
      formatPdfPrice(row.gstAmount),
      formatPdfPrice(row.saleValue),
    ]),
    foot: [[
      "Total",
      formatPdfPrice(includingGstTotal),
      formatPdfPrice(taxableTotal),
      formatPdfPrice(gstTotal),
      formatPdfPrice(saleTotal),
    ]],
    styles: { fontSize: 9, cellPadding: 2.5, lineColor: [220, 220, 220], lineWidth: 0.2 },
    headStyles: { fillColor: [13, 148, 136], textColor: 255, fontStyle: "bold", fontSize: 9 },
    footStyles: { fillColor: [240, 253, 250], textColor: [15, 118, 110], fontStyle: "bold", fontSize: 9 },
    columnStyles: {
      1: { halign: "right" },
      2: { halign: "right" },
      3: { halign: "right" },
      4: { halign: "right" },
    },
    alternateRowStyles: { fillColor: [248, 248, 250] },
    margin: { left: 14, right: 14 },
  })

  addPdfFooter(doc, logoDataUrl, title)
  const tagFile = orderTag === ALL_ORDER_TAGS ? "All_Tags" : safeFileName(orderTag)
  doc.save(`Samrat_GST_Report_${tagFile}_${new Date().toISOString().slice(0, 10)}.pdf`)
}

export function gstSaleRecordTitle(orderTag: string): string {
  const tag = orderTag === ALL_ORDER_TAGS ? "All order tags" : orderTag
  return `Samrat Market GST sale record of ${tag}`
}

/** GST sale record PDF: summary columns plus Sale % and Sale Amount. */
export async function downloadGstSaleRecordReport(
  catalogs: GstPurchaseCatalog[],
  orderTag: string,
  configuredPercents: number[],
  salePercentsByTag: GstSaleRecordPercents
): Promise<void> {
  const { slabs, lines } = gstWiseReportData(catalogs, orderTag, configuredPercents)
  const tagPercents = salePercentsByTag[orderTag] ?? {}
  const rows = slabs.map((row) => {
    const salePercent = Number(tagPercents[row.gstKey]) || 0
    return {
      ...row,
      salePercent,
      saleAmount: saleAmountFromMrp(row.taxable, salePercent),
    }
  })
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" })
  const logoDataUrl = await loadLogoDataUrl()
  const dateStr = new Date().toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
  const title = gstSaleRecordTitle(orderTag)
  const taxableTotal = roundMoney(rows.reduce((sum, row) => sum + row.taxable, 0))
  const gstTotal = roundMoney(rows.reduce((sum, row) => sum + row.gstAmount, 0))
  const mrpTotal = roundMoney(rows.reduce((sum, row) => sum + row.saleValue, 0))
  const saleAmountTotal = roundMoney(rows.reduce((sum, row) => sum + row.saleAmount, 0))

  addPdfHeader(
    doc,
    logoDataUrl,
    "GST Purchase Catalog",
    title,
    `${lines.length} products  |  ${dateStr}`
  )

  autoTable(doc, {
    startY: 49,
    head: [["GST", "Taxable", "GST Amt", "MRP Sale", "Sale %", "Sale Amount"]],
    body: rows.map((row) => [
      pdfSafe(row.label),
      formatPdfPrice(row.taxable),
      formatPdfPrice(row.gstAmount),
      formatPdfPrice(row.saleValue),
      row.salePercent ? `${row.salePercent}%` : "—",
      formatPdfPrice(row.saleAmount),
    ]),
    foot: [[
      "Total",
      formatPdfPrice(taxableTotal),
      formatPdfPrice(gstTotal),
      formatPdfPrice(mrpTotal),
      "",
      formatPdfPrice(saleAmountTotal),
    ]],
    styles: { fontSize: 9, cellPadding: 2.5, lineColor: [220, 220, 220], lineWidth: 0.2 },
    headStyles: { fillColor: [13, 148, 136], textColor: 255, fontStyle: "bold", fontSize: 9 },
    footStyles: { fillColor: [240, 253, 250], textColor: [15, 118, 110], fontStyle: "bold", fontSize: 9 },
    columnStyles: {
      1: { halign: "right" },
      2: { halign: "right" },
      3: { halign: "right" },
      4: { halign: "center" },
      5: { halign: "right" },
    },
    alternateRowStyles: { fillColor: [248, 248, 250] },
    margin: { left: 14, right: 14 },
  })

  addPdfFooter(doc, logoDataUrl, title)
  const tagFile = orderTag === ALL_ORDER_TAGS ? "All_Tags" : safeFileName(orderTag)
  doc.save(`Samrat_GST_Sale_Record_${tagFile}_${new Date().toISOString().slice(0, 10)}.pdf`)
}
