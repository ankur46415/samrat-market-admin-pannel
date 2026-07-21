import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"
import { format } from "date-fns"

interface ReportData {
  dateRange: {
    from?: Date | undefined
    to?: Date | undefined
  }
  stats: {
    totalRevenue: number
    totalProfit: number
    paymentBreakdown: Record<string, number>
    salesCount: number
  }
  topProducts: {
    name: string
    quantity: number
    revenue: number
  }[]
  dailyData: {
    date: string
    revenue: number
    count: number
  }[]
}

export function generatePdfReport(data: ReportData) {
  const { dateRange, stats, topProducts, dailyData } = data
  
  const doc = new jsPDF()
  
  // Helper function
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount)
  }

  // Header
  doc.setFontSize(24)
  doc.setFont("helvetica", "bold")
  doc.text("Samrat Market", 105, 20, { align: "center" })
  
  doc.setFontSize(14)
  doc.setFont("helvetica", "normal")
  doc.text("Sales Report", 105, 30, { align: "center" })
  
  // Date range
  doc.setFontSize(10)
  doc.setTextColor(100)
  const dateText = dateRange.from && dateRange.to
    ? `${format(dateRange.from, "MMM dd, yyyy")} - ${format(dateRange.to, "MMM dd, yyyy")}`
    : "All Time"
  doc.text(dateText, 105, 38, { align: "center" })
  
  doc.setTextColor(0)
  
  // Summary section
  doc.setFontSize(12)
  doc.setFont("helvetica", "bold")
  doc.text("Summary", 14, 52)
  
  doc.setFont("helvetica", "normal")
  doc.setFontSize(10)
  
  const summaryData = [
    ["Total Revenue", formatCurrency(stats.totalRevenue)],
    ["Estimated Profit", formatCurrency(stats.totalProfit)],
    ["Total Transactions", stats.salesCount.toString()],
    ["Profit Margin", stats.totalRevenue > 0 
      ? `${((stats.totalProfit / stats.totalRevenue) * 100).toFixed(1)}%` 
      : "0%"],
  ]
  
  autoTable(doc, {
    startY: 56,
    head: [],
    body: summaryData,
    theme: "plain",
    styles: { fontSize: 10 },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 50 },
      1: { halign: "right" },
    },
    margin: { left: 14, right: 14 },
  })
  
  // Payment breakdown
  const paymentY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10
  doc.setFontSize(12)
  doc.setFont("helvetica", "bold")
  doc.text("Payment Methods", 14, paymentY)
  
  const paymentData = Object.entries(stats.paymentBreakdown).map(([method, amount]) => [
    method.charAt(0).toUpperCase() + method.slice(1),
    formatCurrency(amount),
    `${((amount / stats.totalRevenue) * 100).toFixed(1)}%`,
  ])
  
  if (paymentData.length > 0) {
    autoTable(doc, {
      startY: paymentY + 4,
      head: [["Method", "Amount", "% of Total"]],
      body: paymentData,
      theme: "striped",
      styles: { fontSize: 10 },
      headStyles: { fillColor: [100, 80, 200] },
      margin: { left: 14, right: 14 },
    })
  }
  
  // Top products
  const productsY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10
  doc.setFontSize(12)
  doc.setFont("helvetica", "bold")
  doc.text("Top Selling Products", 14, productsY)
  
  const productsData = topProducts.slice(0, 10).map((product, index) => [
    (index + 1).toString(),
    product.name,
    product.quantity.toString(),
    formatCurrency(product.revenue),
  ])
  
  if (productsData.length > 0) {
    autoTable(doc, {
      startY: productsY + 4,
      head: [["#", "Product", "Qty Sold", "Revenue"]],
      body: productsData,
      theme: "striped",
      styles: { fontSize: 10 },
      headStyles: { fillColor: [100, 80, 200] },
      columnStyles: {
        0: { cellWidth: 15 },
        3: { halign: "right" },
      },
      margin: { left: 14, right: 14 },
    })
  }
  
  // Daily breakdown (new page if needed)
  const dailyY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10
  
  if (dailyY > 250) {
    doc.addPage()
    doc.setFontSize(12)
    doc.setFont("helvetica", "bold")
    doc.text("Daily Revenue Breakdown", 14, 20)
  } else {
    doc.setFontSize(12)
    doc.setFont("helvetica", "bold")
    doc.text("Daily Revenue Breakdown", 14, dailyY)
  }
  
  const dailyTableData = dailyData.map((day) => [
    day.date,
    day.count.toString(),
    formatCurrency(day.revenue),
  ])
  
  if (dailyTableData.length > 0) {
    autoTable(doc, {
      startY: dailyY > 250 ? 24 : dailyY + 4,
      head: [["Date", "Transactions", "Revenue"]],
      body: dailyTableData,
      theme: "striped",
      styles: { fontSize: 9 },
      headStyles: { fillColor: [100, 80, 200] },
      columnStyles: {
        2: { halign: "right" },
      },
      margin: { left: 14, right: 14 },
    })
  }
  
  // Footer
  const pageCount = doc.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFontSize(8)
    doc.setTextColor(150)
    doc.text(
      `Generated on ${format(new Date(), "MMM dd, yyyy 'at' h:mm a")} | Page ${i} of ${pageCount}`,
      105,
      290,
      { align: "center" }
    )
  }
  
  // Save the PDF
  const filename = `samrat-market-report-${format(new Date(), "yyyy-MM-dd")}.pdf`
  doc.save(filename)
}
