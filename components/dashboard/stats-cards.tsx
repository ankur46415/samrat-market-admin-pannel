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
      bgColor: "bg-chart-1/15",
      borderColor: "border-chart-1/30",
    },
    {
      title: "Total Revenue",
      value: formatCurrency(stats.totalRevenue),
      icon: CreditCard,
      description: "All time revenue",
      color: "text-chart-2",
      bgColor: "bg-chart-2/15",
      borderColor: "border-chart-2/30",
    },
    {
      title: "Customers",
      value: stats.totalCustomers.toString(),
      icon: Users,
      description: "Registered customers",
      color: "text-chart-3",
      bgColor: "bg-chart-3/15",
      borderColor: "border-chart-3/30",
    },
    {
      title: "Low Stock Items",
      value: stats.lowStockCount.toString(),
      icon: AlertTriangle,
      description: stats.lowStockCount > 0 ? "Needs attention" : "All stocked",
      color: stats.lowStockCount > 0 ? "text-destructive" : "text-chart-4",
      bgColor: stats.lowStockCount > 0 ? "bg-destructive/15" : "bg-chart-4/15",
      borderColor: stats.lowStockCount > 0 ? "border-destructive/30" : "border-chart-4/30",
    },
  ]

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => {
        const Icon = card.icon
        return (
          <Card key={card.title} className={`relative overflow-hidden border ${card.borderColor} hover:border-opacity-100 hover:shadow-lg transition-all duration-300 hover:scale-105`}>
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 hover:opacity-100 transition-opacity duration-300" />
            <CardHeader className="flex flex-row items-center justify-between pb-2 relative z-10">
              <CardTitle className="text-sm font-semibold text-muted-foreground tracking-wide uppercase">
                {card.title}
              </CardTitle>
              <div className={`rounded-lg p-2.5 ${card.bgColor} transition-all duration-300`}>
                <Icon className={`h-5 w-5 ${card.color}`} strokeWidth={1.5} />
              </div>
            </CardHeader>
            <CardContent className="relative z-10">
              <div className="text-3xl font-bold tracking-tight">{card.value}</div>
              <p className="text-xs text-muted-foreground/80 mt-2">
                {card.description}
              </p>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
