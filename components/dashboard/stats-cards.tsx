"use client"

import { useState } from "react"
import { IndianRupee, Users, AlertTriangle, CreditCard, Eye, EyeOff } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import type { DashboardStats } from "@/lib/types"

interface StatsCardsProps {
  stats: DashboardStats
}

export function StatsCards({ stats }: StatsCardsProps) {
  const [showSalesTotals, setShowSalesTotals] = useState(false)

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount)
  }

  const salesCards = [
    {
      title: "Today's Sales",
      value: formatCurrency(stats.todaySales),
      icon: IndianRupee,
      description: "Total revenue today",
      color: "text-chart-1",
      bgColor: "bg-chart-1/10",
    },
    {
      title: "Total Sales",
      value: formatCurrency(stats.totalRevenue),
      icon: CreditCard,
      description: "All-time revenue",
      color: "text-chart-2",
      bgColor: "bg-chart-2/10",
    },
  ]

  const publicCards = [
    {
      title: "Customers",
      value: stats.totalCustomers.toString(),
      icon: Users,
      description: "Registered customers",
      color: "text-chart-3",
      bgColor: "bg-chart-3/10",
    },
    {
      title: "Low Stock Items",
      value: stats.lowStockCount.toString(),
      icon: AlertTriangle,
      description: stats.lowStockCount > 0 ? "Needs attention" : "All stocked",
      color: stats.lowStockCount > 0 ? "text-destructive" : "text-chart-4",
      bgColor: stats.lowStockCount > 0 ? "bg-destructive/10" : "bg-chart-4/10",
    },
  ]

  const cards = showSalesTotals ? [...salesCards, ...publicCards] : publicCards

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={() => setShowSalesTotals((v) => !v)}
          aria-pressed={showSalesTotals}
        >
          {showSalesTotals ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          {showSalesTotals ? "Hide today & total sales" : "Show today & total sales"}
        </Button>
      </div>
      <div
        className={`grid gap-4 md:grid-cols-2 ${showSalesTotals ? "lg:grid-cols-4" : "lg:grid-cols-2"}`}
      >
        {cards.map((card) => {
          const Icon = card.icon
          return (
            <Card key={card.title} className="relative overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {card.title}
                </CardTitle>
                <div className={`rounded-full p-2 ${card.bgColor}`}>
                  <Icon className={`h-4 w-4 ${card.color}`} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{card.value}</div>
                <p className="text-xs text-muted-foreground mt-1">{card.description}</p>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
