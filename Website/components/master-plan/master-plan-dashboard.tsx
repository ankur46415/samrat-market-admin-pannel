"use client"

import { useMemo, useState, useEffect } from "react"
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
} from "recharts"
import {
  Map as MapIcon,
  Plus,
  Search,
  IndianRupee,
  TrendingUp,
  Percent,
  Pencil,
  Trash2,
  Minus,
  Cloud,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Tags,
  GitBranch,
  Download,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useMasterPlan } from "@/hooks/use-master-plan"
import type { MasterPlanItem } from "@/lib/features/master-plan/models"
import { DEFAULT_MASTER_PLAN_BRANCH } from "@/lib/features/master-plan/constants"
import { CHART_FILLS } from "@/lib/chart-colors"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  MasterPlanDeleteDialog,
  MasterPlanItemDialog,
  MasterPlanCategoryDialog,
  MasterPlanBranchDialog,
  MasterPlanBulkImportDialog,
  formatInr,
  itemMargin,
  masterPlanCategoryName,
} from "@/components/master-plan/master-plan-dialogs"
import type { SyncStatus } from "@/hooks/use-master-plan"
import { jsPDF } from "jspdf"
import autoTable from "jspdf-autotable"

function SyncBadge({ status }: { status: SyncStatus }) {
  const config: Record<
    SyncStatus,
    { text: string; icon: typeof Cloud; variant: "secondary" | "outline" | "destructive" }
  > = {
    connecting: { text: "Connecting…", icon: Loader2, variant: "secondary" },
    syncing: { text: "Saving…", icon: Loader2, variant: "outline" },
    synced: { text: "Synced", icon: CheckCircle2, variant: "secondary" },
    error: { text: "Sync error", icon: AlertCircle, variant: "destructive" },
    offline: { text: "Offline", icon: Cloud, variant: "secondary" },
  }
  const { text, icon: Icon, variant } = config[status] ?? config.offline
  const spinning = status === "connecting" || status === "syncing"

  return (
    <Badge variant={variant} className="gap-1.5 px-3 py-1.5 text-xs font-medium">
      <Icon className={cn("h-3.5 w-3.5", spinning && "animate-spin")} />
      {text}
    </Badge>
  )
}

export function MasterPlanDashboard() {
  const {
    branches,
    activeBranch,
    activeBranchId,
    setActiveBranchId,
    items,
    allCategories,
    branchSummaries,
    totalAllBranchesInvestment,
    loading,
    syncStatus,
    stats,
    categories,
    addCustomCategory,
    updateCustomCategory,
    deleteCustomCategory,
    createBranch,
    updateBranch,
    deleteBranch,
    addItem,
    addItemsBulk,
    updateItem,
    deleteItem,
    adjustQty,
  } = useMasterPlan()

  const [categoryFilter, setCategoryFilter] = useState<string>("All")
  const [searchQuery, setSearchQuery] = useState("")
  const [itemDialogOpen, setItemDialogOpen] = useState(false)
  const [bulkImportDialogOpen, setBulkImportDialogOpen] = useState(false)
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false)
  const [branchDialogOpen, setBranchDialogOpen] = useState(false)
  const [isEditingEnabled, setIsEditingEnabled] = useState(false)
  const [editingItem, setEditingItem] = useState<MasterPlanItem | null>(null)
  const [deletingItem, setDeletingItem] = useState<MasterPlanItem | null>(null)

  useEffect(() => {
    setCategoryFilter("All")
    setSearchQuery("")
  }, [activeBranchId])

  /** Merge allCategories with any category IDs found on items but missing from allCategories */
  const filterCategories = useMemo(() => {
    const catMap = new Map(allCategories.map((c) => [c.id, c]))

    items.forEach((item) => {
      if (item.category && !catMap.has(item.category)) {
        // Build a clean display name: strip "custom-" prefix and title-case
        const raw = item.category.startsWith("custom-")
          ? item.category.slice(7)
          : item.category
        const displayName = raw
          .replace(/-/g, " ")
          .replace(/\b\w/g, (ch) => ch.toUpperCase())

        catMap.set(item.category, {
          id: item.category,
          name: displayName,
          color: "#64748B",
        })
      }
    })

    return Array.from(catMap.values())
  }, [allCategories, items])

  const filteredItems = useMemo(() => {
    const q = searchQuery.toLowerCase()
    return items.filter((item) => {
      const matchesCategory = categoryFilter === "All" || item.category === categoryFilter
      const matchesSearch =
        item.name.toLowerCase().includes(q) || item.brand.toLowerCase().includes(q)
      return matchesCategory && matchesSearch
    })
  }, [items, categoryFilter, searchQuery])

  const tableTotals = useMemo(() => {
    return filteredItems.reduce(
      (acc, item) => {
        acc.budget += item.whls * item.qty
        acc.profit += (item.mrp - item.whls) * item.qty
        acc.qty += item.qty
        return acc
      },
      { budget: 0, profit: 0, qty: 0 }
    )
  }, [filteredItems])

  const budgetChartData = categories.filter((c) => c.cost > 0)
  const profitChartData = categories
    .filter((c) => c.cost > 0 || c.profit > 0)
    .map((c) => ({
      id: c.id,
      name: c.name,
      shortName: c.name.length > 14 ? `${c.name.slice(0, 12)}…` : c.name,
      cost: Math.round(c.cost),
      profit: Math.round(c.profit),
      color: c.color,
    }))

  const allBranchesChartData = branchSummaries
    .filter((b) => b.totalInvestment > 0)
    .map((b, index) => ({
      ...b,
      color: CHART_FILLS[index % CHART_FILLS.length],
    }))

  const topProfitCategory = profitChartData.length > 0
    ? profitChartData.reduce((prev, curr) => (prev.profit > curr.profit ? prev : curr))
    : null

  const topMarginCategory = profitChartData.length > 0
    ? profitChartData.reduce((prev, curr) => {
      const prevMargin = prev.cost > 0 ? (prev.profit / prev.cost) : 0
      const currMargin = curr.cost > 0 ? (curr.profit / curr.cost) : 0
      return prevMargin > currMargin ? prev : curr
    })
    : null

  if (loading) {
    return <MasterPlanSkeleton />
  }

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-8 pb-10">
      {/* Page header */}
      <div className="flex flex-col gap-6 border-b border-blue-100 pb-8 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="flex items-center gap-2 text-blue-600">
            <MapIcon className="h-7 w-7 shrink-0" aria-hidden />
            <span className="text-sm font-bold uppercase tracking-widest text-blue-500">Master Plan</span>
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 drop-shadow-sm">
            {activeBranch?.name ?? DEFAULT_MASTER_PLAN_BRANCH.name}
          </h1>
          <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center">
            <Select value={activeBranchId ?? undefined} onValueChange={setActiveBranchId}>
              <SelectTrigger className="w-full sm:w-56 border-blue-200 bg-white shadow-sm focus:ring-blue-500">
                <SelectValue placeholder="Select branch" />
              </SelectTrigger>
              <SelectContent>
                {branches.map((branch) => (
                  <SelectItem key={branch.id} value={branch.id}>
                    {branch.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" className="shadow-sm border-blue-200 text-blue-700 hover:bg-blue-50 hover:text-blue-800 transition-colors" onClick={() => setBranchDialogOpen(true)}>
              <GitBranch className="mr-2 h-4 w-4" />
              Manage Branches
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <SyncBadge status={syncStatus} />
            <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700 px-3 py-1 font-semibold shadow-sm">
              {stats.itemCount} items
            </Badge>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button
            variant="outline"
            className="shadow-sm border-blue-200 text-blue-700 hover:bg-blue-50 hover:text-blue-800 transition-colors"
            onClick={() => setCategoryDialogOpen(true)}
          >
            <Tags className="mr-2 h-4 w-4" />
            Add Category
          </Button>
          <Button
            variant="outline"
            className="shadow-sm border-blue-200 text-blue-700 hover:bg-blue-50 hover:text-blue-800 transition-colors"
            onClick={() => setBulkImportDialogOpen(true)}
          >
            <Plus className="mr-2 h-4 w-4" />
            Import Bulk
          </Button>
          <Button
            className="shadow-lg shadow-orange-500/20 border-none bg-gradient-to-r from-orange-500 to-orange-600 text-white hover:from-orange-600 hover:to-orange-700 transition-all duration-300 transform hover:-translate-y-0.5"
            onClick={() => {
              setEditingItem(null)
              setItemDialogOpen(true)
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add item
          </Button>
        </div>
      </div>

      {/* All branches overview */}
      <Card className="border-blue-200/60 bg-gradient-to-br from-white to-blue-50/40 shadow-xl shadow-blue-900/5">
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between pb-6 border-b border-blue-100">
          <div className="space-y-1">
            <CardTitle className="text-2xl font-bold text-blue-900">All Branches Overview</CardTitle>
            <CardDescription className="text-blue-700/70 font-medium">
              Investment and profit breakdown across your network
            </CardDescription>
          </div>
          <div className="text-left sm:text-right bg-blue-50/50 px-6 py-4 rounded-2xl border border-blue-100 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-widest text-blue-600 mb-1">Total Investment</p>
            <p className="text-4xl font-black tabular-nums text-blue-900 drop-shadow-sm leading-none">{formatInr(totalAllBranchesInvestment)}</p>
          </div>
        </CardHeader>
        <CardContent className="pt-6 space-y-8">
          {branchSummaries.length === 0 ? (
            <p className="text-sm text-muted-foreground">No branches yet.</p>
          ) : (
            <>
              {/* Row 1: three charts side by side, equal height */}
              <div className="grid gap-4 lg:grid-cols-3">
                <div className="rounded-xl border border-blue-100 bg-white/60 p-4">
                  <p className="text-sm font-bold text-slate-800 mb-3">Investment Share</p>
                  <div className="h-[240px]">
                    {allBranchesChartData.length === 0 ? (
                      <div className="flex h-full items-center justify-center text-muted-foreground">
                        No investment data yet
                      </div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={allBranchesChartData}
                            dataKey="totalInvestment"
                            nameKey="branchName"
                            cx="50%"
                            cy="50%"
                            innerRadius={45}
                            outerRadius={75}
                            paddingAngle={2}
                          >
                            {allBranchesChartData.map((entry) => (
                              <Cell key={entry.branchId} fill={entry.color} stroke="#ffffff" strokeWidth={3} />
                            ))}
                          </Pie>
                          <Tooltip
                            content={({ active, payload }) => {
                              if (!active || !payload?.length) return null
                              const d = payload[0].payload as (typeof allBranchesChartData)[number]
                              return (
                                <div className="rounded-xl border border-blue-100 bg-white/95 backdrop-blur-sm p-4 shadow-xl shadow-blue-900/10">
                                  <div className="flex items-center gap-2">
                                    <div className="h-3 w-3 rounded-full shadow-sm" style={{ backgroundColor: d.color }} />
                                    <p className="text-sm font-bold text-slate-800">{d.branchName}</p>
                                  </div>
                                  <p className="mt-2 text-base font-semibold tabular-nums text-blue-700">{formatInr(d.totalInvestment)}</p>
                                  <p className="text-xs font-medium text-slate-500">{d.sharePercent.toFixed(1)}% of total</p>
                                </div>
                              )
                            }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </div>

                <div className="rounded-xl border border-blue-100 bg-white/60 p-4">
                  <p className="text-sm font-bold text-slate-800 mb-3">Profit by Branch</p>
                  <div className="h-[240px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={branchSummaries} layout="vertical" margin={{ left: 8, right: 16 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#dbeafe" />
                        <XAxis type="number" tick={{ fontSize: 11, fill: "#64748b" }} tickFormatter={(v) => formatInr(v)} />
                        <YAxis
                          type="category"
                          dataKey="branchName"
                          tick={{ fontSize: 11, fill: "#64748b" }}
                          width={80}
                        />
                        <Tooltip
                          content={({ active, payload }) => {
                            if (!active || !payload?.length) return null
                            const d = payload[0].payload as (typeof branchSummaries)[number]
                            return (
                              <div className="rounded-xl border border-blue-100 bg-white/95 backdrop-blur-sm p-3 shadow-xl shadow-blue-900/10">
                                <p className="text-sm font-bold text-slate-800">{d.branchName}</p>
                                <p className="text-sm font-semibold tabular-nums text-orange-600">{formatInr(d.grossProfit)}</p>
                              </div>
                            )
                          }}
                        />
                        <Bar dataKey="grossProfit" fill="#f97316" radius={[0, 6, 6, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="rounded-xl border border-blue-100 bg-white/60 p-4">
                  <p className="text-sm font-bold text-slate-800 mb-3">Investment vs Profit</p>
                  <div className="h-[240px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={branchSummaries} margin={{ left: 0, right: 8 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#dbeafe" />
                        <XAxis dataKey="branchName" tick={{ fontSize: 10, fill: "#64748b" }} />
                        <YAxis tick={{ fontSize: 11, fill: "#64748b" }} tickFormatter={(v) => formatInr(v)} />
                        <Tooltip
                          content={({ active, payload, label }) => {
                            if (!active || !payload?.length) return null
                            return (
                              <div className="rounded-xl border border-blue-100 bg-white/95 backdrop-blur-sm p-3 shadow-xl shadow-blue-900/10">
                                <p className="text-sm font-bold text-slate-800 mb-1">{label}</p>
                                {payload.map((p) => (
                                  <p key={p.dataKey} className="text-xs font-semibold tabular-nums" style={{ color: p.color }}>
                                    {p.name}: {formatInr(p.value as number)}
                                  </p>
                                ))}
                              </div>
                            )
                          }}
                        />
                        <Bar dataKey="totalInvestment" name="Investment" fill="#3b82f6" radius={[6, 6, 0, 0]} />
                        <Bar dataKey="grossProfit" name="Profit" fill="#f97316" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* Row 2: branch cards, full width, wraps naturally */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {branchSummaries.map((branch, index) => {
                  const isActive = branch.branchId === activeBranchId
                  const color = CHART_FILLS[index % CHART_FILLS.length]
                  return (
                    <div
                      key={branch.branchId}
                      className={cn(
                        "rounded-xl border p-4 transition-all duration-300",
                        isActive
                          ? "border-blue-400 bg-blue-50/80 shadow-md shadow-blue-500/10 scale-[1.02]"
                          : "border-blue-100 bg-white hover:border-blue-300 hover:shadow-md"
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="h-3.5 w-3.5 shrink-0 rounded-full shadow-sm" style={{ backgroundColor: color }} />
                          <div>
                            <p className="font-bold text-slate-800">{branch.branchName}</p>
                            {isActive ? (
                              <p className="text-xs font-semibold text-blue-600">Currently viewing</p>
                            ) : null}
                          </div>
                        </div>
                        <Badge variant="outline" className="shrink-0 tabular-nums border-blue-200 text-blue-700 bg-blue-50/50">
                          {branch.sharePercent.toFixed(1)}%
                        </Badge>
                      </div>
                      <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
                        <div className="bg-white/60 p-2 rounded-lg border border-slate-100">
                          <p className="text-xs font-medium text-slate-500">Investment</p>
                          <p className="font-bold tabular-nums text-slate-800">{formatInr(branch.totalInvestment)}</p>
                        </div>
                        <div className="bg-orange-50/50 p-2 rounded-lg border border-orange-100">
                          <p className="text-xs font-medium text-orange-600/80">Profit</p>
                          <p className="font-bold tabular-nums text-orange-600">
                            {formatInr(branch.grossProfit)}
                          </p>
                        </div>
                        <div className="bg-white/60 p-2 rounded-lg border border-slate-100">
                          <p className="text-xs font-medium text-slate-500">Items</p>
                          <p className="font-bold tabular-nums text-slate-800">{branch.itemCount}</p>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Current branch KPIs */}
      <div className="flex items-center gap-2">
        <Badge variant="secondary" className="text-sm font-bold bg-blue-100 text-blue-800 px-4 py-1.5 shadow-sm">
          {activeBranch?.name ?? "Branch"} — details below
        </Badge>
      </div>

      {/* KPI stats */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Card className="border-blue-100 bg-white shadow-lg shadow-blue-900/5 hover:shadow-xl transition-shadow duration-300">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-bold text-slate-600 uppercase tracking-wider">Total Investment</CardTitle>
            <div className="rounded-xl bg-blue-100 p-2.5 shadow-inner">
              <IndianRupee className="h-5 w-5 text-blue-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-extrabold tabular-nums text-slate-800">{formatInr(stats.totalInvestment)}</div>
            <p className="mt-2 text-xs font-medium text-slate-500">Opening stock purchase cost</p>
          </CardContent>
        </Card>
        <Card className="border-orange-100 bg-gradient-to-br from-white to-orange-50/30 shadow-lg shadow-orange-900/5 hover:shadow-xl transition-shadow duration-300">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-bold text-orange-600 uppercase tracking-wider">Est. Gross Profit</CardTitle>
            <div className="rounded-xl bg-gradient-to-br from-orange-100 to-orange-200 p-2.5 shadow-inner">
              <TrendingUp className="h-5 w-5 text-orange-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-extrabold tabular-nums text-orange-600 drop-shadow-sm">
              {formatInr(stats.grossProfit)}
            </div>
            <p className="mt-2 text-xs font-medium text-orange-700/60">Expected margin on opening stock</p>
          </CardContent>
        </Card>
        <Card className="border-blue-100 bg-white shadow-lg shadow-blue-900/5 hover:shadow-xl transition-shadow duration-300 sm:col-span-2 xl:col-span-1">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-bold text-slate-600 uppercase tracking-wider">Weighted Avg Margin</CardTitle>
            <div className="rounded-xl bg-blue-50 p-2.5 shadow-inner border border-blue-100">
              <Percent className="h-5 w-5 text-blue-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-extrabold tabular-nums text-slate-800">{stats.weightedMargin.toFixed(1)}<span className="text-2xl text-slate-400">%</span></div>
            <p className="mt-2 text-xs font-medium text-slate-500">Across all categories</p>
          </CardContent>
        </Card>
      </div>
      {/* Charts */}
      <div className="grid gap-6 xl:grid-cols-2 items-stretch">
        <Card className="border-blue-100 bg-white shadow-lg shadow-blue-900/5 flex flex-col">
          <CardHeader>
            <CardTitle className="text-slate-800">Budget Allocation</CardTitle>
            <CardDescription className="text-slate-500 font-medium">Opening stock investment by category</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col flex-1">
            <div className="flex-1 min-h-[200px]">
              {budgetChartData.length === 0 ? (
                <div className="flex h-full items-center justify-center text-muted-foreground">
                  No data yet
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={budgetChartData}
                      dataKey="cost"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={85}
                      paddingAngle={2}
                    >
                      {budgetChartData.map((entry, index) => (
                        <Cell
                          key={entry.id}
                          fill={entry.color || CHART_FILLS[index % CHART_FILLS.length]}
                          stroke="#ffffff"
                          strokeWidth={2}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null
                        const d = payload[0].payload as {
                          name: string
                          cost: number
                          color?: string
                        }
                        return (
                          <div className="rounded-xl border border-blue-100 bg-white/95 backdrop-blur-sm p-4 shadow-xl shadow-blue-900/10">
                            <div className="flex items-center gap-2">
                              <div
                                className="h-3 w-3 rounded-full shadow-sm"
                                style={{ backgroundColor: d.color }}
                              />
                              <p className="text-sm font-bold text-slate-800">{d.name}</p>
                            </div>
                            <p className="mt-2 text-lg font-extrabold tabular-nums text-blue-700">
                              {formatInr(d.cost)}
                            </p>
                          </div>
                        )
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>

            {budgetChartData.length > 0 ? (
              <div className="mt-6 grid gap-3 sm:grid-cols-2 shrink-0">
                {budgetChartData.map((entry, index) => (
                  <div key={entry.id} className="flex items-center gap-3 bg-slate-50/50 p-2 rounded-lg border border-slate-100">
                    <div
                      className="h-3.5 w-3.5 shrink-0 rounded-full shadow-sm"
                      style={{
                        backgroundColor:
                          entry.color || CHART_FILLS[index % CHART_FILLS.length],
                      }}
                    />
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-600">
                      {entry.name}
                    </span>
                    <span className="shrink-0 font-bold text-slate-800 tabular-nums">
                      {formatInr(entry.cost)}
                    </span>
                  </div>
                ))}
              </div>
            ) : null}

            {budgetChartData.length > 0 ? (
              <div className="grid grid-cols-2 gap-4 mt-6 pt-4 border-t border-slate-100 shrink-0">
                <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100/60 shadow-sm flex flex-col justify-between">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-blue-600/80 mb-1">Total Categories</p>
                  <p className="text-xl font-black tabular-nums text-blue-700">{budgetChartData.length}</p>
                </div>
                <div className="bg-orange-50/50 p-4 rounded-xl border border-orange-100/60 shadow-sm flex flex-col justify-between">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-orange-600/80 mb-1">Biggest Allocation</p>
                  {(() => {
                    const top = [...budgetChartData].sort((a, b) => b.cost - a.cost)[0]
                    return (
                      <div>
                        <p className="text-sm font-extrabold text-slate-800 leading-tight mb-0.5 truncate" title={top.name}>{top.name}</p>
                        <p className="text-xs font-black tabular-nums text-orange-600">{formatInr(top.cost)}</p>
                      </div>
                    )
                  })()}
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card className="border-blue-100 bg-white shadow-lg shadow-blue-900/5 flex flex-col">
          <CardHeader>
            <CardTitle className="text-slate-800">Investment vs. Profit Yield</CardTitle>
            <CardDescription className="text-slate-500 font-medium">Purchase cost vs expected gross profit per category</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col flex-1">
            <div className="flex-1 min-h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={profitChartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/60" />
                  <XAxis
                    dataKey="shortName"
                    tick={{ fontSize: 10 }}
                    className="text-muted-foreground"
                  />
                  <YAxis tick={{ fontSize: 11 }} className="text-muted-foreground" />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null
                      const d = payload[0].payload as {
                        name: string
                        cost: number
                        profit: number
                      }
                      return (
                        <div className="rounded-xl border border-blue-100 bg-white/95 backdrop-blur-sm p-4 shadow-xl shadow-blue-900/10">
                          <p className="mb-2 text-sm font-bold text-slate-800">{d.name}</p>
                          <div className="space-y-1">
                            <p className="text-sm font-medium tabular-nums text-slate-600">
                              Purchase: <span className="font-bold text-slate-800">{formatInr(d.cost)}</span>
                            </p>
                            <p className="text-sm font-medium tabular-nums text-orange-600">
                              Profit: <span className="font-bold text-orange-600">{formatInr(d.profit)}</span>
                            </p>
                          </div>
                        </div>
                      )
                    }}
                  />
                  <Legend wrapperStyle={{ paddingTop: '20px' }} />
                  <Bar dataKey="cost" name="Purchase Cost" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="profit" name="Gross Profit" fill="#f97316" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {(topProfitCategory || topMarginCategory) && (
              <div className="grid grid-cols-2 gap-4 mt-6 pt-4 border-t border-slate-100 shrink-0">
                {topMarginCategory && (
                  <div className="bg-orange-50/50 p-4 rounded-xl border border-orange-100/60 shadow-sm flex flex-col justify-between">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-orange-600/80 mb-1">Highest Margin</p>
                    <div>
                      <p className="text-sm font-extrabold text-slate-800 leading-tight mb-0.5 truncate" title={topMarginCategory.name}>{topMarginCategory.name}</p>
                      <p className="text-xs font-black tabular-nums text-orange-600">
                        {topMarginCategory.cost > 0 ? ((topMarginCategory.profit / topMarginCategory.cost) * 100).toFixed(1) : 0}% Yield
                      </p>
                    </div>
                  </div>
                )}
                {topProfitCategory && (
                  <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100/60 shadow-sm flex flex-col justify-between">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-blue-600/80 mb-1">Top Contributor</p>
                    <div>
                      <p className="text-sm font-extrabold text-slate-800 leading-tight mb-0.5 truncate" title={topProfitCategory.name}>{topProfitCategory.name}</p>
                      <p className="text-xs font-black tabular-nums text-blue-700">
                        {formatInr(topProfitCategory.profit)} Profit
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Inventory table */}
      <Card className="border-blue-200 bg-white shadow-2xl shadow-blue-900/10 ring-1 ring-black/5 overflow-hidden">
        <CardHeader className="space-y-1 border-b border-blue-100 bg-gradient-to-r from-blue-50/80 to-white pb-6">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2">
              <CardTitle className="text-2xl font-bold text-blue-900">Inventory Matrix</CardTitle>
              <CardDescription className="text-blue-700/80 font-medium">
                Manage quantities, wholesale & retail prices — <span className="font-bold text-orange-600">{filteredItems.length}</span> of {items.length} items shown
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="shrink-0 shadow-sm border-blue-200 text-blue-700 hover:bg-blue-100 hover:text-blue-800 font-semibold"
              disabled={filteredItems.length === 0}
              onClick={async () => {
                const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" })
                const pageW = doc.internal.pageSize.getWidth()
                const pageH = doc.internal.pageSize.getHeight()

                const branchName = activeBranch?.name ?? "Master Plan"
                const filterLabel =
                  categoryFilter === "All"
                    ? "All Items"
                    : filterCategories.find((c) => c.id === categoryFilter)?.name ?? categoryFilter

                // ── Load logo once ──
                let logoDataUrl: string | null = null
                try {
                  const resp = await fetch("/images/samrat-market-logo.png")
                  const blob = await resp.blob()
                  logoDataUrl = await new Promise<string>((res) => {
                    const reader = new FileReader()
                    reader.onloadend = () => res(reader.result as string)
                    reader.readAsDataURL(blob)
                  })
                } catch {
                  // continue without logo
                }

                // ── Header with logo ──
                const logoH = 16
                if (logoDataUrl) {
                  doc.addImage(logoDataUrl, "PNG", 14, 8, logoH, logoH)
                }

                const textX = logoDataUrl ? 14 + logoH + 4 : 14
                doc.setFontSize(22)
                doc.setFont("helvetica", "bold")
                doc.setTextColor(27, 27, 31)
                doc.text("Samrat Market", textX, 17)

                doc.setFontSize(10)
                doc.setFont("helvetica", "normal")
                doc.setTextColor(100)
                doc.text("Zafarabad, Jaunpur, Uttar Pradesh", textX, 23)

                // Divider line
                doc.setDrawColor(200)
                doc.setLineWidth(0.4)
                doc.line(14, 28, pageW - 14, 28)

                // Branch & filter info
                doc.setFontSize(13)
                doc.setFont("helvetica", "bold")
                doc.setTextColor(39, 39, 42)
                doc.text(branchName, 14, 37)

                doc.setFontSize(9)
                doc.setFont("helvetica", "normal")
                doc.setTextColor(120)
                const dateStr = new Date().toLocaleDateString("en-IN", {
                  day: "2-digit", month: "short", year: "numeric",
                })
                doc.text(`Category: ${filterLabel}  •  ${filteredItems.length} items  •  ${dateStr}`, 14, 43)
                doc.setTextColor(0)

                // ── Table ──
                autoTable(doc, {
                  startY: 49,
                  head: [["#", "Item Name", "Size", "Qty"]],
                  body: filteredItems.map((item, idx) => [
                    idx + 1,
                    item.name,
                    item.size || "—",
                    item.qty,
                  ]),
                  styles: { fontSize: 10, cellPadding: 3.5, lineColor: [220, 220, 220], lineWidth: 0.2 },
                  headStyles: {
                    fillColor: [27, 27, 31],
                    textColor: 255,
                    fontStyle: "bold",
                    fontSize: 10,
                  },
                  columnStyles: {
                    0: { halign: "center", cellWidth: 14 },
                    1: { cellWidth: 100 },
                    3: { halign: "center", cellWidth: 20 },
                  },
                  alternateRowStyles: { fillColor: [248, 248, 250] },
                  margin: { left: 14, right: 14 },
                })

                // ── Footer with logo on every page ──
                const totalPages = doc.getNumberOfPages()
                for (let i = 1; i <= totalPages; i++) {
                  doc.setPage(i)

                  // Footer divider
                  doc.setDrawColor(210)
                  doc.setLineWidth(0.3)
                  doc.line(14, pageH - 20, pageW - 14, pageH - 20)

                  // Logo (small, centered)
                  if (logoDataUrl) {
                    const logoSize = 10
                    doc.addImage(logoDataUrl, "PNG", (pageW - logoSize) / 2, pageH - 18, logoSize, logoSize)
                  }

                  // Footer text
                  doc.setFontSize(7)
                  doc.setTextColor(160)
                  doc.text("Samrat Market  •  Zafarabad, Jaunpur", pageW / 2, pageH - 6, { align: "center" })

                  // Page number
                  doc.text(`Page ${i} of ${totalPages}`, pageW - 14, pageH - 6, { align: "right" })
                }

                doc.save(`Samrat_Market_${branchName.replace(/\s+/g, "_")}_${new Date().toISOString().slice(0, 10)}.pdf`)
              }}
            >
              <Download className="mr-2 h-4 w-4" />
              Download PDF
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6 pt-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full sm:max-w-md">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-blue-400" />
              <Input
                placeholder="Search items or brands…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-12 rounded-xl border-blue-200 pl-11 shadow-sm focus-visible:ring-blue-500 bg-blue-50/30 text-base"
              />
            </div>
            <div className="flex shrink-0 items-center gap-3 rounded-xl border border-orange-200 bg-orange-50/80 px-5 py-3 shadow-sm">
              <Switch
                id="edit-mode"
                checked={isEditingEnabled}
                onCheckedChange={setIsEditingEnabled}
                className="data-[state=checked]:bg-orange-500"
              />
              <Label htmlFor="edit-mode" className="cursor-pointer font-bold text-orange-800 uppercase tracking-wide text-xs">
                Edit Quantities
              </Label>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 pt-2">
            <CategoryPill active={categoryFilter === "All"} onClick={() => setCategoryFilter("All")}>
              All items
            </CategoryPill>
            {filterCategories.map((cat) => (
              <CategoryPill
                key={cat.id}
                active={categoryFilter === cat.id}
                onClick={() => setCategoryFilter(cat.id)}
              >
                {cat.name}
              </CategoryPill>
            ))}
          </div>

          <div className="overflow-x-auto rounded-xl border border-blue-200 bg-white shadow-xl shadow-blue-900/5 ring-1 ring-blue-100">
            {filteredItems.length === 0 ? (
              <div className="py-24 text-center">
                <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-blue-50 mb-4">
                  <Search className="h-8 w-8 text-blue-300" />
                </div>
                <h3 className="text-lg font-semibold text-slate-800">No matching items</h3>
                <p className="mt-1 text-slate-500">Try adjusting your search or category filter.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-gradient-to-r from-blue-700 via-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-600 border-none">
                    <TableHead className="w-8 px-2 text-center text-xs font-bold text-blue-50 uppercase tracking-wider">#</TableHead>
                    <TableHead className="px-2 text-xs font-bold text-blue-50 uppercase tracking-wider">Item</TableHead>
                    <TableHead className="px-2 text-xs font-bold text-blue-50 uppercase tracking-wider">Category</TableHead>
                    <TableHead className="px-2 text-xs font-bold text-blue-50 uppercase tracking-wider">Brand</TableHead>
                    <TableHead className="px-2 text-xs text-right font-bold text-blue-50 uppercase tracking-wider">Size</TableHead>
                    <TableHead className="px-2 text-xs text-right font-bold text-blue-50 uppercase tracking-wider">Whls</TableHead>
                    <TableHead className="px-2 text-xs text-right font-bold text-blue-50 uppercase tracking-wider">MRP</TableHead>
                    <TableHead className="px-2 text-xs text-right font-bold text-blue-50 uppercase tracking-wider">Margin</TableHead>
                    <TableHead className="px-2 text-xs text-center w-[100px] font-bold text-blue-50 uppercase tracking-wider">Qty</TableHead>
                    <TableHead className="px-2 text-xs text-right font-bold text-blue-50 uppercase tracking-wider">Total</TableHead>
                    <TableHead className="px-2 text-xs text-right font-extrabold text-orange-200 uppercase tracking-wider">Profit</TableHead>
                    <TableHead className="w-16 px-2 text-xs text-center font-bold text-blue-50 uppercase tracking-wider">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredItems.map((item, idx) => {
                    const totalCost = item.whls * item.qty
                    const totalProfit = (item.mrp - item.whls) * item.qty
                    const margin = itemMargin(item.mrp, item.whls)
                    return (
                      <TableRow key={item.id} className="hover:bg-blue-50/50 transition-colors border-b border-blue-50">
                        <TableCell className="px-2 text-center text-xs text-slate-400 font-medium tabular-nums">
                          {idx + 1}
                        </TableCell>
                        <TableCell className="px-2 text-xs font-bold text-slate-800 max-w-[140px] truncate" title={item.name}>{item.name}</TableCell>
                        <TableCell className="px-2 text-xs">
                          <Badge variant="secondary" className="px-2 py-0.5 text-[10px] font-semibold max-w-[80px] truncate block text-center bg-blue-100 text-blue-700 hover:bg-blue-200 border-none">
                            {masterPlanCategoryName(item.category, filterCategories)}
                          </Badge>
                        </TableCell>
                        <TableCell className="px-2 text-xs text-slate-500 font-medium max-w-[80px] truncate" title={item.brand}>
                          {item.brand}
                        </TableCell>
                        <TableCell className="px-2 text-xs text-right text-slate-500 whitespace-nowrap">
                          {item.size}
                        </TableCell>
                        <TableCell className="px-2 text-xs text-right text-slate-600 font-semibold tabular-nums whitespace-nowrap">₹{item.whls.toFixed(2)}</TableCell>
                        <TableCell className="px-2 text-xs text-right text-slate-800 font-bold tabular-nums whitespace-nowrap">₹{item.mrp.toFixed(2)}</TableCell>
                        <TableCell className="px-2 text-xs text-right">
                          <Badge variant="outline" className="px-2 py-0.5 text-[10px] tabular-nums font-bold block text-center w-max ml-auto bg-orange-50 border-orange-200 text-orange-700">
                            {margin.toFixed(1)}%
                          </Badge>
                        </TableCell>
                        <TableCell className="px-2">
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="h-6 w-6 shrink-0 border-blue-200 text-blue-600 hover:bg-blue-100 hover:border-blue-300"
                              disabled={!isEditingEnabled}
                              onClick={() => adjustQty(item.id, -1)}
                            >
                              <Minus className="h-3 w-3" />
                            </Button>
                            <Input
                              type="number"
                              min={0}
                              value={item.qty}
                              disabled={!isEditingEnabled}
                              onChange={(e) => {
                                const val = parseInt(e.target.value, 10)
                                updateItem(item.id, {
                                  qty: Number.isFinite(val) && val >= 0 ? val : 0,
                                })
                              }}
                              className="h-6 w-12 px-0 text-center text-xs font-bold text-blue-900 border-blue-200 focus-visible:ring-blue-500 tabular-nums disabled:opacity-50 disabled:bg-slate-50 disabled:cursor-not-allowed [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                              onWheel={(e) => e.currentTarget.blur()}
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="h-6 w-6 shrink-0 border-blue-200 text-blue-600 hover:bg-blue-100 hover:border-blue-300"
                              disabled={!isEditingEnabled}
                              onClick={() => adjustQty(item.id, 1)}
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell className="px-2 text-xs text-right font-bold text-blue-700 tabular-nums whitespace-nowrap">
                          {formatInr(totalCost)}
                        </TableCell>
                        <TableCell className="px-2 text-xs text-right font-extrabold tabular-nums text-orange-600 whitespace-nowrap">
                          {formatInr(totalProfit)}
                        </TableCell>
                        <TableCell className="px-2">
                          <div className="flex justify-center gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 shrink-0 text-blue-500 hover:bg-blue-100 hover:text-blue-700"
                              disabled={!isEditingEnabled}
                              onClick={() => {
                                setEditingItem(item)
                                setItemDialogOpen(true)
                              }}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                              <span className="sr-only">Edit</span>
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 shrink-0 text-red-400 hover:bg-red-50 hover:text-red-600"
                              disabled={!isEditingEnabled}
                              onClick={() => setDeletingItem(item)}
                            >
                              <Trash2 className="h-3 w-3" />
                              <span className="sr-only">Delete</span>
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
                <TableFooter className="bg-gradient-to-r from-blue-50 to-white border-t-2 border-blue-200 shadow-[inset_0_1px_0_rgba(255,255,255,1)]">
                  <TableRow>
                    <TableCell colSpan={8} className="px-2 text-right text-[11px] font-extrabold text-blue-800 uppercase tracking-widest">
                      Filtered total ({filteredItems.length})
                    </TableCell>
                    <TableCell className="px-2 text-center text-sm font-black text-blue-900 tabular-nums">
                      {tableTotals.qty.toLocaleString("en-IN")}
                    </TableCell>
                    <TableCell className="px-2 text-right text-sm font-black text-blue-700 tabular-nums whitespace-nowrap">
                      {formatInr(tableTotals.budget)}
                    </TableCell>
                    <TableCell className="px-2 text-right text-sm font-black text-orange-600 tabular-nums whitespace-nowrap">
                      {formatInr(tableTotals.profit)}
                    </TableCell>
                    <TableCell className="px-2" />
                  </TableRow>
                </TableFooter>
              </Table>
            )}
          </div>
        </CardContent>
      </Card>

      <MasterPlanItemDialog
        open={itemDialogOpen}
        onOpenChange={setItemDialogOpen}
        item={editingItem}
        categories={filterCategories}
        onSave={async (input) => {
          if (editingItem) {
            await updateItem(editingItem.id, input)
          } else {
            await addItem(input)
          }
        }}
      />

      <MasterPlanBulkImportDialog
        open={bulkImportDialogOpen}
        onOpenChange={setBulkImportDialogOpen}
        categories={filterCategories}
        onSaveBulk={addItemsBulk}
      />

      <MasterPlanCategoryDialog
        open={categoryDialogOpen}
        onOpenChange={setCategoryDialogOpen}
        categories={filterCategories}
        onAdd={async (name) => {
          await addCustomCategory(name)
        }}
        onUpdate={updateCustomCategory}
        onDelete={deleteCustomCategory}
      />

      <MasterPlanBranchDialog
        open={branchDialogOpen}
        onOpenChange={setBranchDialogOpen}
        branches={branches}
        activeBranchId={activeBranchId}
        onSelect={setActiveBranchId}
        onAdd={async (name) => {
          await createBranch(name)
        }}
        onUpdate={updateBranch}
        onDelete={deleteBranch}
      />

      <MasterPlanDeleteDialog
        item={deletingItem}
        onOpenChange={(open) => !open && setDeletingItem(null)}
        onConfirm={async () => {
          if (deletingItem) await deleteItem(deletingItem.id)
        }}
      />
    </div>
  )
}

function CategoryPill({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-4 py-1.5 text-xs font-bold transition-all duration-300 sm:text-sm shadow-sm",
        active
          ? "border-blue-600 bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-md shadow-blue-500/30 scale-105"
          : "border-blue-200 bg-white text-blue-700 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-900 hover:shadow"
      )}
    >
      {children}
    </button>
  )
}

function MasterPlanSkeleton() {
  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-8 pb-10">
      <div className="space-y-3 border-b border-border/60 pb-8">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-9 w-72" />
        <Skeleton className="h-4 w-full max-w-xl" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-32 rounded-xl" />
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <Skeleton className="h-80 rounded-xl" />
        <Skeleton className="h-80 rounded-xl" />
      </div>
      <Skeleton className="h-96 rounded-xl" />
    </div>
  )
}
