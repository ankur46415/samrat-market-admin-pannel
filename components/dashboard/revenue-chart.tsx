"use client"

import { useMemo } from "react"
import { format, subDays, startOfDay, endOfDay } from "date-fns"
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { Sale } from "@/lib/types"
import { cn } from "@/lib/utils"

interface RevenueChartProps {
  sales: Sale[]
  className?: string
}

export function RevenueChart({ sales, className }: RevenueChartProps) {
  const chartData = useMemo(() => {
    const last7Days = Array.from({ length: 7 }).map((_, i) => {
      const date = subDays(new Date(), 6 - i)
      return {
        date: format(date, "MMM dd"),
        fullDate: date,
        revenue: 0,
      }
    })

    sales.forEach((sale) => {
      const saleDate = sale.createdAt
      const dayIndex = last7Days.findIndex((day) => {
        const start = startOfDay(day.fullDate)
        const end = endOfDay(day.fullDate)
        return saleDate >= start && saleDate <= end
      })
      if (dayIndex !== -1) {
        last7Days[dayIndex].revenue += sale.total
      }
    })

    return last7Days.map(({ date, revenue }) => ({ date, revenue }))
  }, [sales])

  const formatCurrency = (value: number) => {
    if (value >= 1000) {
      return `₹${(value / 1000).toFixed(1)}k`
    }
    return `₹${value}`
  }

  return (
    <Card className={cn(className, "border-chart-1/30 hover:border-chart-1/50 transition-colors")}>
      <CardHeader className="pb-6">
        <CardTitle className="text-xl">Revenue Trend</CardTitle>
        <CardDescription className="text-sm">Daily revenue for the last 7 days</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--chart-1)" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="var(--chart-1)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted/20" vertical={false} />
              <XAxis
                dataKey="date"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                dy={10}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                tickFormatter={formatCurrency}
                dx={-10}
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div className="rounded-lg border border-chart-1/50 bg-card/95 backdrop-blur-sm p-3 shadow-xl">
                        <p className="text-sm font-medium text-muted-foreground">{label}</p>
                        <p className="text-lg font-bold text-chart-1 mt-1">
                          ₹{payload[0].value?.toLocaleString("en-IN")}
                        </p>
                      </div>
                    )
                  }
                  return null
                }}
              />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="var(--chart-1)"
                strokeWidth={3}
                fill="url(#revenueGradient)"
                isAnimationActive={true}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
