import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  MASTER_PLAN_CATEGORIES,
  branchCategoriesToOptions,
  slugifyCategoryId,
  isDuplicateCategoryName,
  isDuplicateCategoryNameExcept,
  isDuplicateBranchName,
  type MasterPlanCategoryOption,
} from "@/lib/features/master-plan/constants"
import { CHART_FILLS } from "@/lib/chart-colors"
import type {
  MasterPlanBranch,
  MasterPlanBranchCategory,
  MasterPlanBranchSummary,
  MasterPlanCategoryAggregate,
  MasterPlanItem,
  MasterPlanItemInput,
  MasterPlanStats,
} from "@/lib/features/master-plan/models"
import { masterPlanService } from "@/lib/features/master-plan/services/master_plan_service"

export type SyncStatus = "connecting" | "syncing" | "synced" | "error" | "offline"

function sumItems(items: MasterPlanItem[]) {
  return items.reduce(
    (acc, item) => {
      acc.investment += item.whls * item.qty
      acc.profit += (item.mrp - item.whls) * item.qty
      return acc
    },
    { investment: 0, profit: 0 }
  )
}

function computeStats(
  items: MasterPlanItem[],
  categoryOptions: MasterPlanCategoryOption[]
): {
  stats: MasterPlanStats
  categories: MasterPlanCategoryAggregate[]
} {
  const sums = new Map<string, { cost: number; profit: number }>()
  categoryOptions.forEach((c) => sums.set(c.id, { cost: 0, profit: 0 }))

  let totalInvestment = 0
  let grossProfit = 0

  items.forEach((item) => {
    const totalCost = item.whls * item.qty
    const totalProfit = (item.mrp - item.whls) * item.qty
    totalInvestment += totalCost
    grossProfit += totalProfit

    if (!sums.has(item.category)) {
      sums.set(item.category, { cost: 0, profit: 0 })
    }
    const bucket = sums.get(item.category)!
    bucket.cost += totalCost
    bucket.profit += totalProfit
  })

  const optionById = new Map(categoryOptions.map((c) => [c.id, c]))
  const categories: MasterPlanCategoryAggregate[] = []

  sums.forEach((sumsForCat, id) => {
    const meta = optionById.get(id)
    const revenue = sumsForCat.cost + sumsForCat.profit
    const margin = revenue > 0 ? (sumsForCat.profit / revenue) * 100 : 0
    categories.push({
      id,
      name: meta?.name ?? id,
      color: meta?.color ?? "#64748B",
      cost: sumsForCat.cost,
      profit: sumsForCat.profit,
      margin: parseFloat(margin.toFixed(1)),
    })
  })

  categories.sort((a, b) => a.name.localeCompare(b.name))

  const weightedMargin =
    totalInvestment + grossProfit > 0 ? (grossProfit / (totalInvestment + grossProfit)) * 100 : 0

  return {
    stats: {
      totalInvestment,
      grossProfit,
      weightedMargin,
      itemCount: items.length,
    },
    categories,
  }
}

export function useMasterPlan() {
  const [branches, setBranches] = useState<MasterPlanBranch[]>([])
  const [itemsByBranch, setItemsByBranch] = useState<Record<string, MasterPlanItem[]>>({})
  const [branchCategories, setBranchCategories] = useState<MasterPlanBranchCategory[]>([])
  const [activeBranchId, setActiveBranchId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("connecting")
  const [error, setError] = useState<string | null>(null)
  const seedAttempted = useRef(false)
  const categoriesSeedAttempted = useRef<Record<string, boolean>>({})

  const items = useMemo(
    () => (activeBranchId ? itemsByBranch[activeBranchId] ?? [] : []),
    [activeBranchId, itemsByBranch]
  )

  const allCategories = useMemo(
    () => branchCategoriesToOptions(branchCategories),
    [branchCategories]
  )

  useEffect(() => {
    setSyncStatus("connecting")
    const unsub = masterPlanService.subscribeBranches(
      (data) => {
        setBranches(data)
        setSyncStatus("synced")
        setError(null)
        if (data.length === 0 && !seedAttempted.current) {
          seedAttempted.current = true
          setSyncStatus("syncing")
          masterPlanService
            .seedDefaultBranchIfEmpty()
            .then(() => setSyncStatus("synced"))
            .catch((err) => {
              setSyncStatus("error")
              setError(err instanceof Error ? err.message : "Failed to seed master plan")
            })
        }
        setLoading(false)
      },
      (err) => {
        setSyncStatus("error")
        setError(err.message)
        setLoading(false)
      }
    )
    return () => unsub()
  }, [])

  useEffect(() => {
    if (branches.length === 0) return
    setActiveBranchId((current) => {
      if (current && branches.some((b) => b.id === current)) return current
      return branches.find((b) => b.isDefault)?.id ?? branches[0].id
    })
  }, [branches])

  useEffect(() => {
    if (branches.length === 0) return
    const unsubs = branches.map((branch) =>
      masterPlanService.subscribeItems(branch.id, (data) => {
        setItemsByBranch((prev) => ({ ...prev, [branch.id]: data }))
      })
    )
    return () => unsubs.forEach((u) => u())
  }, [branches])

  useEffect(() => {
    if (!activeBranchId) {
      setBranchCategories([])
      return
    }
    const unsub = masterPlanService.subscribeBranchCategories(
      activeBranchId,
      (data) => {
        setBranchCategories(data)
        if (data.length === 0 && !categoriesSeedAttempted.current[activeBranchId]) {
          const branch = branches.find((b) => b.id === activeBranchId)
          if (branch?.isDefault) {
            categoriesSeedAttempted.current[activeBranchId] = true
            masterPlanService.seedDefaultCategories(activeBranchId).catch(() => {
              categoriesSeedAttempted.current[activeBranchId] = false
            })
          }
        }
      },
      (err) => setError(err.message)
    )
    return () => unsub()
  }, [activeBranchId, branches])

  const { stats, categories } = useMemo(
    () => computeStats(items, allCategories),
    [items, allCategories]
  )

  const branchSummaries = useMemo((): MasterPlanBranchSummary[] => {
    const rows = branches.map((branch) => {
      const branchItems = itemsByBranch[branch.id] ?? []
      const { investment, profit } = sumItems(branchItems)
      return {
        branchId: branch.id,
        branchName: branch.name,
        totalInvestment: investment,
        grossProfit: profit,
        itemCount: branchItems.length,
        sharePercent: 0,
      }
    })
    const grandTotal = rows.reduce((sum, r) => sum + r.totalInvestment, 0)
    return rows.map((r) => ({
      ...r,
      sharePercent: grandTotal > 0 ? (r.totalInvestment / grandTotal) * 100 : 0,
    }))
  }, [branches, itemsByBranch])

  const totalAllBranchesInvestment = useMemo(
    () => branchSummaries.reduce((sum, b) => sum + b.totalInvestment, 0),
    [branchSummaries]
  )

  const addCustomCategory = useCallback(
    async (name: string) => {
      if (!activeBranchId) throw new Error("Select a branch first.")
      const trimmed = name.trim()
      if (!trimmed) throw new Error("Please enter a category name.")
      if (isDuplicateCategoryName(trimmed, allCategories)) {
        throw new Error("This category already exists in this branch.")
      }
      setSyncStatus("syncing")
      const id = slugifyCategoryId(trimmed)
      const color = CHART_FILLS[branchCategories.length % CHART_FILLS.length]
      await masterPlanService.addBranchCategory(activeBranchId, {
        id,
        name: trimmed,
        color,
        sortOrder: branchCategories.length + 1,
      })
      setSyncStatus("synced")
    },
    [activeBranchId, allCategories, branchCategories.length]
  )

  const updateCustomCategory = useCallback(
    async (id: string, name: string) => {
      if (!activeBranchId) return
      const trimmed = name.trim()
      if (!trimmed) throw new Error("Please enter a category name.")
      if (isDuplicateCategoryNameExcept(trimmed, allCategories, id)) {
        throw new Error("This category name already exists in this branch.")
      }
      setSyncStatus("syncing")
      await masterPlanService.updateBranchCategory(activeBranchId, id, trimmed)
      setSyncStatus("synced")
    },
    [activeBranchId, allCategories]
  )

  const deleteCustomCategory = useCallback(
    async (id: string) => {
      if (!activeBranchId) return
      const inUse = items.some((item) => item.category === id)
      if (inUse) {
        throw new Error("Cannot delete — items in this branch use this category.")
      }
      setSyncStatus("syncing")
      await masterPlanService.deleteBranchCategory(activeBranchId, id)
      setSyncStatus("synced")
    },
    [activeBranchId, items]
  )

  const addItem = useCallback(
    async (input: MasterPlanItemInput) => {
      if (!activeBranchId) return
      setSyncStatus("syncing")
      await masterPlanService.addItem(activeBranchId, input, items.length + 1)
      setSyncStatus("synced")
    },
    [activeBranchId, items.length]
  )

  const updateItem = useCallback(
    async (itemId: string, input: Partial<MasterPlanItemInput & { qty: number }>) => {
      if (!activeBranchId) return
      setSyncStatus("syncing")
      await masterPlanService.updateItem(activeBranchId, itemId, input)
      setSyncStatus("synced")
    },
    [activeBranchId]
  )

  const deleteItem = useCallback(
    async (itemId: string) => {
      if (!activeBranchId) return
      setSyncStatus("syncing")
      await masterPlanService.deleteItem(activeBranchId, itemId)
      setSyncStatus("synced")
    },
    [activeBranchId]
  )

  const adjustQty = useCallback(
    async (itemId: string, delta: number) => {
      const item = items.find((i) => i.id === itemId)
      if (!item) return
      const next = Math.max(0, item.qty + delta)
      await updateItem(itemId, { qty: next })
    },
    [items, updateItem]
  )

  const activeBranch = useMemo(
    () => branches.find((b) => b.id === activeBranchId) ?? null,
    [branches, activeBranchId]
  )

  const createBranch = useCallback(
    async (name: string) => {
      const trimmed = name.trim()
      if (!trimmed) throw new Error("Please enter a branch name.")
      if (isDuplicateBranchName(trimmed, branches)) {
        throw new Error("This branch already exists.")
      }
      setSyncStatus("syncing")
      const id = await masterPlanService.createBranch(trimmed)
      setActiveBranchId(id)
      setSyncStatus("synced")
      return id
    },
    [branches]
  )

  const updateBranch = useCallback(
    async (id: string, name: string) => {
      const trimmed = name.trim()
      if (!trimmed) throw new Error("Please enter a branch name.")
      if (isDuplicateBranchName(trimmed, branches, id)) {
        throw new Error("This branch name already exists.")
      }
      setSyncStatus("syncing")
      await masterPlanService.updateBranch(id, trimmed)
      setSyncStatus("synced")
    },
    [branches]
  )

  const deleteBranch = useCallback(
    async (id: string) => {
      if (branches.length <= 1) {
        throw new Error("Cannot delete the last branch.")
      }
      setSyncStatus("syncing")
      await masterPlanService.deleteBranch(id)
      if (activeBranchId === id) {
        const remaining = branches.filter((b) => b.id !== id)
        setActiveBranchId(remaining.find((b) => b.isDefault)?.id ?? remaining[0]?.id ?? null)
      }
      setSyncStatus("synced")
    },
    [branches, activeBranchId]
  )

  return {
    branches,
    activeBranch,
    activeBranchId,
    setActiveBranchId,
    items,
    allCategories,
    branchCategories,
    branchSummaries,
    totalAllBranchesInvestment,
    loading,
    syncStatus,
    error,
    stats,
    categories,
    addCustomCategory,
    updateCustomCategory,
    deleteCustomCategory,
    createBranch,
    updateBranch,
    deleteBranch,
    addItem,
    updateItem,
    deleteItem,
    adjustQty,
  }
}
