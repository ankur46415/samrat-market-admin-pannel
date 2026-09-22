"use client"

import { useEffect, useState } from "react"
import type { Sale } from "@/lib/types"
import { fetchSalesInDateRange } from "@/lib/features/sales/services/sales_query_service"

const TODAY_SALES_REFRESH_MS = 2 * 60 * 1000

/** One-time (periodic refresh) today's sales — no full sales collection listener. */
export function useTodaySales() {
  const [sales, setSales] = useState<Sale[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const todayEnd = new Date(today)
      todayEnd.setDate(todayEnd.getDate() + 1)

      try {
        const items = await fetchSalesInDateRange(today, todayEnd)
        if (!cancelled) {
          setSales(items)
          setError(null)
        }
      } catch (err) {
        console.error("Today sales load error:", err)
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load today's sales")
          setSales([])
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    const intervalId = window.setInterval(() => void load(), TODAY_SALES_REFRESH_MS)

    return () => {
      cancelled = true
      window.clearInterval(intervalId)
    }
  }, [])

  return { sales, loading, error }
}
