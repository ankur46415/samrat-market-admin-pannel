"use client"

import { useDashboardStats, useProducts, useSales } from "@/hooks/use-firestore"
import { StatsCards } from "@/components/dashboard/stats-cards"
import { RevenueChart } from "@/components/dashboard/revenue-chart"
import { CategoryChart } from "@/components/dashboard/category-chart"
import { RecentSales } from "@/components/dashboard/recent-sales"
import { LowStockAlert } from "@/components/dashboard/low-stock-alert"
import { Skeleton } from "@/components/ui/skeleton"

export default function DashboardPage() {
  const { stats, loading: statsLoading } = useDashboardStats()
  const { products, loading: productsLoading } = useProducts()
  const { sales, loading: salesLoading } = useSales()

  const loading = statsLoading || productsLoading || salesLoading

  if (loading) {
    return <DashboardSkeleton />
  }

  return (
    <div className="space-y-8">
      {/* ── Header Section ── */}
      <div className="space-y-2">
        <div>
          <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-primary via-primary to-accent bg-clip-text text-transparent">
            Dashboard
          </h1>
          <p className="text-base text-muted-foreground mt-2">
            Welcome back! Here&apos;s your supermarket business overview.
          </p>
        </div>
      </div>

      {/* ── Key Metrics ── */}
      <div>
        <div className="mb-4">
          <h2 className="text-lg font-semibold tracking-tight">Key Metrics</h2>
        </div>
        <StatsCards stats={stats} />
      </div>

      {/* ── Charts Section ── */}
      <div className="grid gap-6 lg:grid-cols-7">
        <div className="lg:col-span-4">
          <RevenueChart sales={sales} />
        </div>
        <div className="lg:col-span-3">
          <CategoryChart products={products} />
        </div>
      </div>

      {/* ── Bottom Section ── */}
      <div className="grid gap-6 lg:grid-cols-7">
        <div className="lg:col-span-4">
          <RecentSales sales={sales} />
        </div>
        <div className="lg:col-span-3">
          <LowStockAlert products={products} />
        </div>
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
