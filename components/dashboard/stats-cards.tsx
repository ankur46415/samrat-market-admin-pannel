"use client"

import { IndianRupee, Users, AlertTriangle, CreditCard } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { DashboardStats } from "@/lib/types"

interface StatsCardsProps {
  stats: DashboardStats
}

export function StatsCards({ stats }: StatsCardsProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount)
  }

  const cards = [
    {
      title: "Today's Sales",
      value: formatCurrency(stats.todaySales),
      icon: IndianRupee,
      description: "Total revenue today",
      color: "text-chart-1",
      bgColor: "bg-chart-1/10",
    },
    {
      title: "Total Revenue",
      value: formatCurrency(stats.totalRevenue),
      icon: CreditCard,
      description: "All time revenue",
      color: "text-chart-2",
      bgColor: "bg-chart-2/10",
    },
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

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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
              <p className="text-xs text-muted-foreground mt-1">
                {card.description}
              </p>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
