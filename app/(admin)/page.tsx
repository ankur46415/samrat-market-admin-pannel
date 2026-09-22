"use client"

import { useEffect, useState } from "react"
import { subDays, startOfDay } from "date-fns"
import { useDashboardStats, useProducts } from "@/hooks/use-firestore"
import { fetchSalesSince } from "@/lib/features/sales/services/sales_query_service"
import type { Sale } from "@/lib/types"
import { StatsCards } from "@/components/dashboard/stats-cards"
import { RevenueChart } from "@/components/dashboard/revenue-chart"
import { CategoryChart } from "@/components/dashboard/category-chart"
import { RecentSales } from "@/components/dashboard/recent-sales"
import { LowStockAlert } from "@/components/dashboard/low-stock-alert"
import { Skeleton } from "@/components/ui/skeleton"

export default function DashboardPage() {
  const { stats, loading: statsLoading } = useDashboardStats({ scope: "full" })
  const { products, loading: productsLoading } = useProducts()
  const [sales, setSales] = useState<Sale[]>([])
  const [salesLoading, setSalesLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const since = startOfDay(subDays(new Date(), 7))
    fetchSalesSince(since, 500)
      .then((items) => {
        if (!cancelled) setSales(items)
      })
      .catch((err) => console.error("Dashboard chart sales load error:", err))
      .finally(() => {
        if (!cancelled) setSalesLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const loading = statsLoading || productsLoading || salesLoading

  if (loading) {
    return <DashboardSkeleton />
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome back. Here&apos;s your business overview.
        </p>
      </div>

      <StatsCards stats={stats} />

      <div className="grid gap-6 lg:grid-cols-7">
        <RevenueChart sales={sales} className="lg:col-span-4" />
        <CategoryChart products={products} className="lg:col-span-3" />
      </div>

      <div className="grid gap-6 lg:grid-cols-7">
        <RecentSales sales={sales} className="lg:col-span-4" />
        <LowStockAlert products={products} className="lg:col-span-3" />
      </div>
    </div>
  )
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-72 mt-2" />
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-32" />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-7">
        <Skeleton className="h-80 lg:col-span-4" />
        <Skeleton className="h-80 lg:col-span-3" />
      </div>
    </div>
  )
}
