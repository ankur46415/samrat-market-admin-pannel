"use client"

import { useMemo } from "react"
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { Product } from "@/lib/types"
import { CHART_FILLS } from "@/lib/chart-colors"
import { cn } from "@/lib/utils"

interface CategoryChartProps {
  products: Product[]
  className?: string
}

export function CategoryChart({ products, className }: CategoryChartProps) {
  const chartData = useMemo(() => {
    const categoryMap = products.reduce((acc, product) => {
      const category = product.category || "Uncategorized"
      acc[category] = (acc[category] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    return Object.entries(categoryMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5)
  }, [products])

  if (chartData.length === 0) {
    return (
      <Card className={cn(className)}>
        <CardHeader>
          <CardTitle>Product Categories</CardTitle>
          <CardDescription>Distribution by category</CardDescription>
        </CardHeader>
        <CardContent className="flex h-[280px] items-center justify-center">
          <p className="text-muted-foreground">No products yet</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={cn(className, "border-chart-2/30 hover:border-chart-2/50 transition-colors")}>
      <CardHeader className="pb-6">
        <CardTitle className="text-xl">Product Categories</CardTitle>
        <CardDescription className="text-sm">Top 5 categories by product count</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[240px] flex items-center justify-center">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={85}
                paddingAngle={3}
                dataKey="value"
                isAnimationActive={true}
              >
                {chartData.map((_, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={CHART_FILLS[index % CHART_FILLS.length]} 
                    opacity={0.85}
                  />
                ))}
              </Pie>
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload
                    return (
                      <div className="rounded-lg border border-chart-2/50 bg-card/95 backdrop-blur-sm p-3 shadow-xl">
                        <p className="text-sm font-medium text-muted-foreground">{data.name}</p>
                        <p className="text-lg font-bold text-chart-2 mt-1">{data.value} products</p>
                      </div>
                    )
                  }
                  return null
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-6 space-y-2">
          {chartData.map((item, index) => (
            <div key={item.name} className="flex items-center gap-3 text-sm">
              <div
                className="h-3 w-3 rounded-full flex-shrink-0 ring-2 ring-offset-2"
                style={{ 
                  backgroundColor: CHART_FILLS[index % CHART_FILLS.length],
                  ringColor: `${CHART_FILLS[index % CHART_FILLS.length]}20`
                }}
              />
              <div className="flex-1 min-w-0">
                <span className="text-muted-foreground font-medium truncate block">{item.name}</span>
              </div>
              <span className="text-foreground font-semibold flex-shrink-0">{item.value}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
