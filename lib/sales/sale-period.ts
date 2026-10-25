import {
  endOfDay,
  isSameDay,
  isWithinInterval,
  startOfDay,
  subDays,
  format,
} from "date-fns"
import type { Sale } from "@/lib/types"
import type { DateRange } from "react-day-picker"

export type SalesPeriodTab = "history" | "yesterday" | "week" | "month" | "profit"

export type SalesDateFilterMode = "single" | "range"

/** Ensures history/profit always have a usable from/to for filtering. */
export function resolveCustomDateRange(
  tab: SalesPeriodTab,
  mode: SalesDateFilterMode,
  singleDay: Date | undefined,
  dateRange: DateRange
): DateRange {
  if (tab !== "history" && tab !== "profit") {
    return dateRange
  }
  if (mode === "single") {
    const day = singleDay ?? new Date()
    return { from: day, to: day }
  }
  if (dateRange.from) {
    return { from: dateRange.from, to: dateRange.to ?? dateRange.from }
  }
  const today = new Date()
  return { from: subDays(today, 29), to: today }
}

export function periodBounds(
  tab: SalesPeriodTab,
  customRange: DateRange
): { from: Date; to: Date } | null {
  const today = new Date()
  switch (tab) {
    case "yesterday": {
      const day = subDays(today, 1)
      return { from: startOfDay(day), to: endOfDay(day) }
    }
    case "week":
      return { from: startOfDay(subDays(today, 6)), to: endOfDay(today) }
    case "month":
      return { from: startOfDay(subDays(today, 29)), to: endOfDay(today) }
    case "history":
    case "profit": {
      if (!customRange.from) return null
      const end = customRange.to ?? customRange.from
      return { from: startOfDay(customRange.from), to: endOfDay(end) }
    }
    default:
      return null
  }
}

export function salesInPeriod(sales: Sale[], from: Date, to: Date): Sale[] {
  return sales.filter((sale) =>
    isWithinInterval(sale.createdAt, { start: from, end: to })
  )
}

export function periodLabel(tab: SalesPeriodTab, customRange: DateRange): string {
  switch (tab) {
    case "yesterday":
      return "Yesterday"
    case "week":
      return "Last 7 days"
    case "month":
      return "Last 30 days"
    case "history": {
      if (!customRange.from) return "Selected period"
      const end = customRange.to ?? customRange.from
      if (isSameDay(customRange.from, end)) {
        return format(customRange.from, "dd MMM yyyy")
      }
      return "Selected range"
    }
    case "profit": {
      if (!customRange.from) return "Profit"
      const end = customRange.to ?? customRange.from
      if (isSameDay(customRange.from, end)) {
        return `Profit · ${format(customRange.from, "dd MMM yyyy")}`
      }
      return "Profit (selected range)"
    }
    default:
      return "Period"
  }
}
