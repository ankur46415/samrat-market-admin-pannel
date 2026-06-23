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

  if (loading) {
    return <MasterPlanSkeleton />
  }

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-8 pb-10">
      {/* Page header */}
      <div className="flex flex-col gap-6 border-b border-border/60 pb-8 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="flex items-center gap-2 text-primary">
            <MapIcon className="h-7 w-7 shrink-0" aria-hidden />
            <span className="text-sm font-medium uppercase tracking-wide">Master Plan</span>
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            {activeBranch?.name ?? DEFAULT_MASTER_PLAN_BRANCH.name}
          </h1>
          <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center">
            <Select value={activeBranchId ?? undefined} onValueChange={setActiveBranchId}>
              <SelectTrigger className="w-full sm:w-56">
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
            <Button variant="outline" className="shadow-sm" onClick={() => setBranchDialogOpen(true)}>
              <GitBranch className="mr-2 h-4 w-4" />
              Manage Branches
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <SyncBadge status={syncStatus} />
            <Badge variant="outline" className="border-primary/20 bg-primary/5 text-primary">
              {stats.itemCount} items
            </Badge>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button
            variant="outline"
            className="shadow-sm"
            onClick={() => setCategoryDialogOpen(true)}
          >
            <Tags className="mr-2 h-4 w-4" />
            Add Category
          </Button>
          <Button
            variant="outline"
            className="shadow-sm"
            onClick={() => setBulkImportDialogOpen(true)}
          >
            <Plus className="mr-2 h-4 w-4" />
            Import Bulk
          </Button>
          <Button
            className="shadow-sm"
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
      <Card className="border-primary/20 bg-primary/[0.02] shadow-md shadow-black/5">
        <CardHeader>
          <CardTitle>All Branches — Total Investment</CardTitle>
          <CardDescription>
            Combined investment across all branches: {formatInr(totalAllBranchesInvestment)}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {branchSummaries.length === 0 ? (
            <p className="text-sm text-muted-foreground">No branches yet.</p>
          ) : (
            <div className="grid gap-6 lg:grid-cols-2">
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
                        innerRadius={50}
                        outerRadius={85}
                        paddingAngle={2}
                      >
                        {allBranchesChartData.map((entry) => (
                          <Cell key={entry.branchId} fill={entry.color} stroke="hsl(var(--background))" strokeWidth={2} />
                        ))}
                      </Pie>
                      <Tooltip
                        content={({ active, payload }) => {
                          if (!active || !payload?.length) return null
                          const d = payload[0].payload as (typeof allBranchesChartData)[number]
                          return (
                            <div className="rounded-lg border bg-background p-3 shadow-lg">
                              <div className="flex items-center gap-2">
                                <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                                <p className="text-sm font-medium">{d.branchName}</p>
                              </div>
                              <p className="mt-1 text-sm tabular-nums">{formatInr(d.totalInvestment)}</p>
                              <p className="text-xs text-muted-foreground">{d.sharePercent.toFixed(1)}% of total</p>
                            </div>
                          )
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
              <div className="space-y-3">
                {branchSummaries.map((branch, index) => {
                  const isActive = branch.branchId === activeBranchId
                  const color = CHART_FILLS[index % CHART_FILLS.length]
                  return (
                    <div
                      key={branch.branchId}
                      className={cn(
                        "rounded-xl border p-4 transition-colors",
                        isActive
                          ? "border-primary/40 bg-primary/5"
                          : "border-border/70 bg-card"
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-2">
                          <div className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: color }} />
                          <div>
                            <p className="font-semibold">{branch.branchName}</p>
                            {isActive ? (
                              <p className="text-xs text-primary">Currently viewing</p>
                            ) : null}
                          </div>
                        </div>
                        <Badge variant="outline" className="shrink-0 tabular-nums">
                          {branch.sharePercent.toFixed(1)}%
                        </Badge>
                      </div>
                      <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
                        <div>
                          <p className="text-xs text-muted-foreground">Investment</p>
                          <p className="font-semibold tabular-nums">{formatInr(branch.totalInvestment)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Profit</p>
                          <p className="font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                            {formatInr(branch.grossProfit)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Items</p>
                          <p className="font-semibold tabular-nums">{branch.itemCount}</p>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Current branch KPIs */}
      <div className="flex items-center gap-2">
        <Badge variant="secondary" className="text-sm font-medium">
          {activeBranch?.name ?? "Branch"} — details below
        </Badge>
      </div>

      {/* KPI stats */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Card className="border-border/80 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Investment</CardTitle>
            <div className="rounded-full bg-chart-1/10 p-2">
              <IndianRupee className="h-4 w-4 text-chart-1" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums">{formatInr(stats.totalInvestment)}</div>
            <p className="mt-1 text-xs text-muted-foreground">Opening stock purchase cost</p>
          </CardContent>
        </Card>
        <Card className="border-border/80 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Est. Gross Profit</CardTitle>
            <div className="rounded-full bg-emerald-500/10 p-2">
              <TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
              {formatInr(stats.grossProfit)}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Expected margin on opening stock</p>
          </CardContent>
        </Card>
        <Card className="border-border/80 shadow-sm sm:col-span-2 xl:col-span-1">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Weighted Avg Margin</CardTitle>
            <div className="rounded-full bg-chart-4/10 p-2">
              <Percent className="h-4 w-4 text-chart-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums">{stats.weightedMargin.toFixed(1)}%</div>
            <p className="mt-1 text-xs text-muted-foreground">Across all categories</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="border-border/80 shadow-md shadow-black/5">
          <CardHeader>
            <CardTitle>Budget Allocation</CardTitle>
            <CardDescription>Opening stock investment by category</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[220px]">
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
                          stroke="hsl(var(--background))"
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
                          <div className="rounded-lg border bg-background p-3 shadow-lg">
                            <div className="flex items-center gap-2">
                              <div
                                className="h-2.5 w-2.5 rounded-full"
                                style={{ backgroundColor: d.color }}
                              />
                              <p className="text-sm font-medium">{d.name}</p>
                            </div>
                            <p className="mt-1 text-lg font-bold tabular-nums">
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
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {budgetChartData.map((entry, index) => (
                  <div key={entry.id} className="flex items-center gap-2 text-sm">
                    <div
                      className="h-3 w-3 shrink-0 rounded-full"
                      style={{
                        backgroundColor:
                          entry.color || CHART_FILLS[index % CHART_FILLS.length],
                      }}
                    />
                    <span className="min-w-0 flex-1 truncate text-muted-foreground">
                      {entry.name}
                    </span>
                    <span className="shrink-0 font-medium tabular-nums">
                      {formatInr(entry.cost)}
                    </span>
                  </div>
                ))}
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card className="border-border/80 shadow-md shadow-black/5">
          <CardHeader>
            <CardTitle>Investment vs. Profit Yield</CardTitle>
            <CardDescription>Purchase cost vs expected gross profit per category</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
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
                        <div className="rounded-lg border bg-background p-3 shadow-lg">
                          <p className="mb-1 text-sm font-medium">{d.name}</p>
                          <p className="text-sm tabular-nums">
                            Purchase: {formatInr(d.cost)}
                          </p>
                          <p className="text-sm tabular-nums">
                            Profit: {formatInr(d.profit)}
                          </p>
                        </div>
                      )
                    }}
                  />
                  <Legend />
                  <Bar dataKey="cost" name="Purchase Cost" fill="hsl(var(--muted))" radius={4} />
                  <Bar dataKey="profit" name="Gross Profit" fill="hsl(var(--chart-2))" radius={4} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Inventory table */}
      <Card className="border-border/80 shadow-md shadow-black/5">
        <CardHeader className="space-y-1 border-b border-border/60 bg-muted/20 pb-4">
          <CardTitle className="text-lg">Inventory Matrix</CardTitle>
          <CardDescription>
            Manage quantities, wholesale & retail prices — {filteredItems.length} of {items.length} items shown
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 pt-6">
          <div className="relative w-full">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search items or brands…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-11 rounded-lg border-border/80 pl-10 shadow-sm"
            />
          </div>

          <div className="flex flex-wrap gap-2">
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

          <div className="overflow-x-auto rounded-xl border border-border/80 bg-card shadow-sm">
            {filteredItems.length === 0 ? (
              <div className="py-16 text-center text-muted-foreground">No matching items found.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableHead className="w-12 text-center">#</TableHead>
                    <TableHead className="min-w-[160px]">Item</TableHead>
                    <TableHead className="hidden lg:table-cell">Category</TableHead>
                    <TableHead className="hidden md:table-cell min-w-[140px]">Brand</TableHead>
                    <TableHead className="hidden sm:table-cell text-right">Size</TableHead>
                    <TableHead className="text-right">Whls</TableHead>
                    <TableHead className="text-right">MRP</TableHead>
                    <TableHead className="text-right">Margin</TableHead>
                    <TableHead className="text-center min-w-[130px]">Qty</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right text-emerald-600 dark:text-emerald-400">Profit</TableHead>
                    <TableHead className="text-center w-24">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredItems.map((item, idx) => {
                    const totalCost = item.whls * item.qty
                    const totalProfit = (item.mrp - item.whls) * item.qty
                    const margin = itemMargin(item.mrp, item.whls)
                    return (
                      <TableRow key={item.id}>
                        <TableCell className="text-center text-muted-foreground tabular-nums">
                          {idx + 1}
                        </TableCell>
                        <TableCell className="font-medium">{item.name}</TableCell>
                        <TableCell className="hidden lg:table-cell">
                          <Badge variant="secondary" className="font-normal">
                            {masterPlanCategoryName(item.category, filterCategories)}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-muted-foreground">
                          {item.brand}
                        </TableCell>
                        <TableCell className="hidden sm:table-cell text-right text-muted-foreground">
                          {item.size}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">₹{item.whls.toFixed(2)}</TableCell>
                        <TableCell className="text-right tabular-nums">₹{item.mrp.toFixed(2)}</TableCell>
                        <TableCell className="text-right">
                          <Badge variant="outline" className="tabular-nums font-normal">
                            {margin.toFixed(1)}%
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => adjustQty(item.id, -1)}
                            >
                              <Minus className="h-3 w-3" />
                            </Button>
                            <Input
                              type="number"
                              min={0}
                              value={item.qty}
                              onChange={(e) => {
                                const val = parseInt(e.target.value, 10)
                                updateItem(item.id, {
                                  qty: Number.isFinite(val) && val >= 0 ? val : 0,
                                })
                              }}
                              className="h-8 w-14 px-1 text-center tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                              onWheel={(e) => e.currentTarget.blur()}
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => adjustQty(item.id, 1)}
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-medium tabular-nums">
                          {formatInr(totalCost)}
                        </TableCell>
                        <TableCell className="text-right font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                          {formatInr(totalProfit)}
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-center gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => {
                                setEditingItem(item)
                                setItemDialogOpen(true)
                              }}
                            >
                              <Pencil className="h-4 w-4" />
                              <span className="sr-only">Edit</span>
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => setDeletingItem(item)}
                            >
                              <Trash2 className="h-4 w-4" />
                              <span className="sr-only">Delete</span>
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
                <TableFooter className="bg-muted/30">
                  <TableRow>
                    <TableCell colSpan={8} className="text-right text-xs font-semibold uppercase tracking-wide">
                      Filtered total ({filteredItems.length})
                    </TableCell>
                    <TableCell className="text-center font-bold tabular-nums">
                      {tableTotals.qty.toLocaleString("en-IN")}
                    </TableCell>
                    <TableCell className="text-right font-bold tabular-nums">
                      {formatInr(tableTotals.budget)}
                    </TableCell>
                    <TableCell className="text-right font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                      {formatInr(tableTotals.profit)}
                    </TableCell>
                    <TableCell />
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
        "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors sm:text-sm",
        active
          ? "border-primary bg-primary text-primary-foreground shadow-sm"
          : "border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground"
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
