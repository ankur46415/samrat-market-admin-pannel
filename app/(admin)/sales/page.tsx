"use client"

import { useState, useMemo, useCallback } from "react"
import { format, subDays, isToday, isSameDay } from "date-fns"
import { CalendarIcon, Eye, EyeOff, Search } from "lucide-react"
import { useSales, useProducts } from "@/hooks/use-firestore"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { SaleDetailDialog } from "@/components/sales/sale-detail-dialog"
import { SaleEditDialog } from "@/components/sales/sale-edit-dialog"
import { SaleBillActions } from "@/components/sales/sale-bill-actions"
import type { Sale } from "@/lib/types"
import { saleMatchesPhoneFilter, saleMatchesSearch, salePhone } from "@/lib/sales-filter"
import {
  periodBounds,
  periodLabel,
  resolveCustomDateRange,
  salesInPeriod,
  type SalesDateFilterMode,
  type SalesPeriodTab,
} from "@/lib/sales/sale-period"
import {
  DEFAULT_PROFIT_MARGIN_NO_COST,
  saleGrossProfit,
  salesGrossProfit,
  salesTotalCost,
} from "@/lib/sales/sale-profit"

import { DateRange } from "react-day-picker"

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount)

function getPaymentBadge(method: string) {
  const variants: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
    cash: "default",
    upi: "secondary",
    card: "outline",
    credit: "destructive",
  }
  return variants[method] || "default"
}

function DatePickerButton({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string
  value: Date | undefined
  placeholder: string
  onChange: (day: Date) => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className="w-full justify-start text-left font-normal"
          >
            <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
            {value ? format(value, "MMM dd, yyyy") : placeholder}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={value}
            onSelect={(day) => {
              if (!day) return
              onChange(day)
              setOpen(false)
            }}
            defaultMonth={value ?? new Date()}
          />
        </PopoverContent>
      </Popover>
    </div>
  )
}

function SalesDateFilter({
  mode,
  onModeChange,
  singleDay,
  onSingleDayChange,
  dateRange,
  onDateRangeChange,
  label,
}: {
  mode: SalesDateFilterMode
  onModeChange: (mode: SalesDateFilterMode) => void
  singleDay: Date
  onSingleDayChange: (day: Date) => void
  dateRange: DateRange
  onDateRangeChange: (range: DateRange) => void
  label?: string
}) {
  const [singleOpen, setSingleOpen] = useState(false)

  const setStartDate = (from: Date) => {
    const to = dateRange.to
    if (to && from.getTime() > to.getTime()) {
      onDateRangeChange({ from, to: from })
    } else {
      onDateRangeChange({ from, to: to ?? from })
    }
  }

  const setEndDate = (to: Date) => {
    const from = dateRange.from ?? to
    if (from.getTime() > to.getTime()) {
      onDateRangeChange({ from: to, to })
    } else {
      onDateRangeChange({ from, to })
    }
  }

  return (
    <div className="space-y-4">
      {label ? <p className="text-sm font-medium text-foreground">{label}</p> : null}
      <div className="flex gap-1 rounded-lg bg-muted/50 p-1">
        <Button
          type="button"
          size="sm"
          variant={mode === "single" ? "default" : "ghost"}
          className="flex-1"
          onClick={() => onModeChange("single")}
        >
          Single day
        </Button>
        <Button
          type="button"
          size="sm"
          variant={mode === "range" ? "default" : "ghost"}
          className="flex-1"
          onClick={() => onModeChange("range")}
        >
          Date range
        </Button>
      </div>

      {mode === "single" ? (
        <Popover open={singleOpen} onOpenChange={setSingleOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" className="w-full sm:w-auto justify-start text-left font-normal">
              <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
              {format(singleDay, "MMM dd, yyyy")}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={singleDay}
              onSelect={(day) => {
                if (!day) return
                onSingleDayChange(day)
                setSingleOpen(false)
              }}
              defaultMonth={singleDay}
            />
          </PopoverContent>
        </Popover>
      ) : (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <DatePickerButton
            label="Start date"
            value={dateRange.from}
            placeholder="Pick start"
            onChange={setStartDate}
          />
          <DatePickerButton
            label="End date"
            value={dateRange.to ?? dateRange.from}
            placeholder="Pick end"
            onChange={setEndDate}
          />
        </div>
      )}
    </div>
  )
}

export default function SalesHistoryPage() {
  const { sales, loading } = useSales()
  const { products } = useProducts()
  const [activeTab, setActiveTab] = useState<SalesPeriodTab>("history")
  const [showPrivateTotals, setShowPrivateTotals] = useState(false)
  const [search, setSearch] = useState("")
  const [phoneFilter, setPhoneFilter] = useState("")
  const [paymentFilter, setPaymentFilter] = useState<string>("all")
  const [dateFilterMode, setDateFilterMode] = useState<"single" | "range">("range")
  const [singleDay, setSingleDay] = useState<Date>(() => new Date())
  const [dateRange, setDateRange] = useState<DateRange>({
    from: subDays(new Date(), 30),
    to: new Date(),
  })
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null)
  const [detailDialogOpen, setDetailDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)

  const productById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products])

  const todaySalesTotal = useMemo(
    () =>
      sales
        .filter((s) => isToday(s.createdAt))
        .reduce((sum, s) => sum + s.total, 0),
    [sales]
  )

  const allTimeSalesTotal = useMemo(() => sales.reduce((sum, s) => sum + s.total, 0), [sales])

  const customRangeForPeriod = useMemo(
    () => resolveCustomDateRange(activeTab, dateFilterMode, singleDay, dateRange),
    [activeTab, dateFilterMode, singleDay, dateRange]
  )

  const bounds = useMemo(
    () => periodBounds(activeTab, customRangeForPeriod),
    [activeTab, customRangeForPeriod]
  )

  const periodSales = useMemo(() => {
    if (!bounds) return []
    return salesInPeriod(sales, bounds.from, bounds.to)
  }, [sales, bounds])

  const filteredSales = useMemo(() => {
    return periodSales.filter((sale) => {
      const matchesSearch = saleMatchesSearch(sale, search)
      const matchesPhone = saleMatchesPhoneFilter(sale, phoneFilter)
      const matchesPayment =
        paymentFilter === "all" || sale.paymentMethod === paymentFilter
      return matchesSearch && matchesPhone && matchesPayment
    })
  }, [periodSales, search, phoneFilter, paymentFilter])

  const totalAmount = filteredSales.reduce((sum, s) => sum + s.total, 0)
  const totalCost = useMemo(() => salesTotalCost(filteredSales, products), [filteredSales, products])
  const totalProfit = useMemo(() => salesGrossProfit(filteredSales, products), [filteredSales, products])
  const profitMarginPct =
    totalAmount > 0 ? (totalProfit / totalAmount) * 100 : 0

  const handleViewSale = (sale: Sale) => {
    setSelectedSale(sale)
    setDetailDialogOpen(true)
  }

  const handleEditSale = (sale: Sale) => {
    setSelectedSale(sale)
    setEditDialogOpen(true)
  }

  const showDateFilter = activeTab === "history" || activeTab === "profit"

  const handleDateRangeChange = useCallback((range: DateRange) => {
    setDateRange(range)
  }, [])

  if (loading) {
    return <SalesSkeleton />
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Sales History</h1>
          <p className="text-muted-foreground">View sales by period, range, and profit</p>
        </div>
        <Button
          type="button"
          variant="outline"
          className="gap-2 shrink-0"
          onClick={() => setShowPrivateTotals((v) => !v)}
          aria-pressed={showPrivateTotals}
        >
          {showPrivateTotals ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          {showPrivateTotals ? "Hide totals" : "Show today & total sales"}
        </Button>
      </div>

      {showPrivateTotals ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Card className="border-primary/20 bg-primary/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Today&apos;s sales
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold tabular-nums">{formatCurrency(todaySalesTotal)}</div>
              <p className="text-xs text-muted-foreground">{format(new Date(), "dd MMM yyyy")}</p>
            </CardContent>
          </Card>
          <Card className="border-primary/20 bg-primary/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total sales (all time)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold tabular-nums">{formatCurrency(allTimeSalesTotal)}</div>
              <p className="text-xs text-muted-foreground">Lifetime revenue</p>
            </CardContent>
          </Card>
        </div>
      ) : null}

      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as SalesPeriodTab)}
        className="space-y-4"
      >
        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1 bg-muted/60 p-1">
          <TabsTrigger value="history" className="rounded-md">
            History
          </TabsTrigger>
          <TabsTrigger value="yesterday" className="rounded-md">
            Last day
          </TabsTrigger>
          <TabsTrigger value="week" className="rounded-md">
            Last week
          </TabsTrigger>
          <TabsTrigger value="month" className="rounded-md">
            Last month
          </TabsTrigger>
          <TabsTrigger value="profit" className="rounded-md">
            Profit
          </TabsTrigger>
        </TabsList>

        <div className="space-y-4">
          {showDateFilter ? (
            <Card>
              <CardContent className="pt-6">
                <SalesDateFilter
                  label={
                    activeTab === "profit"
                      ? "Profit period — single day or date range"
                      : "Sales period — single day or date range"
                  }
                  mode={dateFilterMode}
                  onModeChange={setDateFilterMode}
                  singleDay={singleDay}
                  onSingleDayChange={setSingleDay}
                  dateRange={dateRange}
                  onDateRangeChange={handleDateRangeChange}
                />
              </CardContent>
            </Card>
          ) : null}

          {bounds ? (
            <>
              {activeTab === "profit" ? (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">
                        Revenue
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{formatCurrency(totalAmount)}</div>
                      <p className="text-xs text-muted-foreground">{periodLabel(activeTab, customRangeForPeriod)}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">
                        Est. cost
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{formatCurrency(totalCost)}</div>
                      <p className="text-xs text-muted-foreground">
                        Product cost × qty (from inventory)
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">
                        Gross profit
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                        {formatCurrency(totalProfit)}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Sell amount − product cost; {DEFAULT_PROFIT_MARGIN_NO_COST * 100}% of sell amount
                        if cost is ₹0 or missing
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">
                        Margin
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{profitMarginPct.toFixed(1)}%</div>
                      <p className="text-xs text-muted-foreground">{filteredSales.length} bills</p>
                    </CardContent>
                  </Card>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-3">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">
                        Total sales
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{filteredSales.length}</div>
                      <p className="text-xs text-muted-foreground">transactions</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">
                        Total revenue
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{formatCurrency(totalAmount)}</div>
                      <p className="text-xs text-muted-foreground">{periodLabel(activeTab, customRangeForPeriod)}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">
                        Average order
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {formatCurrency(
                          filteredSales.length > 0 ? totalAmount / filteredSales.length : 0
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">per transaction</p>
                    </CardContent>
                  </Card>
                </div>
              )}

              <Card>
                <CardHeader>
                  <CardTitle>{activeTab === "profit" ? "Profit by bill" : "Transactions"}</CardTitle>
                  <CardDescription>
                    {filteredSales.length} sales ·{" "}
                    {isSameDay(bounds.from, bounds.to)
                      ? format(bounds.from, "MMM dd, yyyy")
                      : `${format(bounds.from, "MMM dd, yyyy")} – ${format(bounds.to, "MMM dd, yyyy")}`}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center mb-6">
                    <div className="relative flex-1 min-w-[200px]">
                      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search bill no or customer..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-8"
                      />
                    </div>

                    <Input
                      type="tel"
                      inputMode="numeric"
                      placeholder="Filter by phone (10 digits)"
                      value={phoneFilter}
                      onChange={(e) =>
                        setPhoneFilter(e.target.value.replace(/\D/g, "").slice(0, 10))
                      }
                      className="w-full sm:w-52 font-mono"
                    />

                    <Select value={paymentFilter} onValueChange={setPaymentFilter}>
                      <SelectTrigger className="w-full sm:w-40">
                        <SelectValue placeholder="Payment" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Payments</SelectItem>
                        <SelectItem value="cash">Cash</SelectItem>
                        <SelectItem value="upi">UPI</SelectItem>
                        <SelectItem value="card">Card</SelectItem>
                        <SelectItem value="credit">Credit</SelectItem>
                      </SelectContent>
                    </Select>

                  </div>

                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Bill No</TableHead>
                          <TableHead>Date & Time</TableHead>
                          <TableHead>Customer</TableHead>
                          <TableHead>Phone</TableHead>
                          <TableHead>Items</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                          {activeTab === "profit" ? (
                            <TableHead className="text-right">Profit</TableHead>
                          ) : null}
                          <TableHead>Payment</TableHead>
                          <TableHead className="w-[148px] text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredSales.length === 0 ? (
                          <TableRow>
                            <TableCell
                              colSpan={activeTab === "profit" ? 9 : 8}
                              className="h-24 text-center"
                            >
                              No sales found.
                            </TableCell>
                          </TableRow>
                        ) : (
                          filteredSales.map((sale) => {
                            const billProfit = saleGrossProfit(sale, productById)
                            return (
                              <TableRow key={sale.id}>
                                <TableCell className="font-medium">{sale.billNo}</TableCell>
                                <TableCell>
                                  <div>
                                    <p className="text-sm">
                                      {format(sale.createdAt, "MMM dd, yyyy")}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                      {format(sale.createdAt, "h:mm a")}
                                    </p>
                                  </div>
                                </TableCell>
                                <TableCell>{sale.customerName || "Walk-in"}</TableCell>
                                <TableCell className="font-mono text-sm">{salePhone(sale)}</TableCell>
                                <TableCell>{sale.items.length} items</TableCell>
                                <TableCell className="text-right font-medium">
                                  {formatCurrency(sale.total)}
                                </TableCell>
                                {activeTab === "profit" ? (
                                  <TableCell className="text-right font-medium text-emerald-600 dark:text-emerald-400">
                                    {formatCurrency(billProfit)}
                                  </TableCell>
                                ) : null}
                                <TableCell>
                                  <Badge variant={getPaymentBadge(sale.paymentMethod)}>
                                    {sale.paymentMethod.toUpperCase()}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-right">
                                  <SaleBillActions
                                    sale={sale}
                                    onView={() => handleViewSale(sale)}
                                    onEdit={() => handleEditSale(sale)}
                                  />
                                </TableCell>
                              </TableRow>
                            )
                          })
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </>
          ) : null}
        </div>
      </Tabs>

      <SaleDetailDialog
        open={detailDialogOpen}
        onOpenChange={setDetailDialogOpen}
        sale={selectedSale}
        onEdit={() => {
          setDetailDialogOpen(false)
          setEditDialogOpen(true)
        }}
      />
      <SaleEditDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        sale={selectedSale}
      />
    </div>
  )
}

function SalesSkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-4 w-64 mt-2" />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
      <Skeleton className="h-[500px]" />
    </div>
  )
}
