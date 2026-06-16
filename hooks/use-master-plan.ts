import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  MASTER_PLAN_CATEGORIES,
  mergeMasterPlanCategories,
  slugifyCategoryId,
  isDuplicateCategoryName,
  isDuplicateCategoryNameExcept,
  isDuplicateBranchName,
  type MasterPlanCategoryOption,
} from "@/lib/features/master-plan/constants"
import { CHART_FILLS } from "@/lib/chart-colors"
import type {
  MasterPlanBranch,
  MasterPlanCategoryAggregate,
  MasterPlanCustomCategory,
  MasterPlanItem,
  MasterPlanItemInput,
  MasterPlanStats,
} from "@/lib/features/master-plan/models"
import { masterPlanService } from "@/lib/features/master-plan/services/master_plan_service"

export type SyncStatus = "connecting" | "syncing" | "synced" | "error" | "offline"

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

  categories.sort((a, b) => {
    const aBuiltIn = MASTER_PLAN_CATEGORIES.findIndex((c) => c.id === a.id)
    const bBuiltIn = MASTER_PLAN_CATEGORIES.findIndex((c) => c.id === b.id)
    if (aBuiltIn !== -1 && bBuiltIn !== -1) return aBuiltIn - bBuiltIn
    if (aBuiltIn !== -1) return -1
    if (bBuiltIn !== -1) return 1
    return a.name.localeCompare(b.name)
  })

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
  const [items, setItems] = useState<MasterPlanItem[]>([])
  const [customCategories, setCustomCategories] = useState<MasterPlanCustomCategory[]>([])
  const [activeBranchId, setActiveBranchId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("connecting")
  const [error, setError] = useState<string | null>(null)
  const seedAttempted = useRef(false)

  const allCategories = useMemo(
    () => mergeMasterPlanCategories(customCategories),
    [customCategories]
  )

  useEffect(() => {
    const unsub = masterPlanService.subscribeCustomCategories(
      (data) => setCustomCategories(data),
      (err) => setError(err.message)
    )
    return () => unsub()
  }, [])

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
    if (!activeBranchId) {
      setItems([])
      return
    }
    setSyncStatus("syncing")
    const unsub = masterPlanService.subscribeItems(
      activeBranchId,
      (data) => {
        setItems(data)
        setSyncStatus("synced")
      },
      (err) => {
        setSyncStatus("error")
        setError(err.message)
      }
    )
    return () => unsub()
  }, [activeBranchId])

  const { stats, categories } = useMemo(
    () => computeStats(items, allCategories),
    [items, allCategories]
  )

  const addCustomCategory = useCallback(
    async (name: string) => {
      const trimmed = name.trim()
      if (!trimmed) throw new Error("Please enter a category name.")
      if (isDuplicateCategoryName(trimmed, allCategories)) {
        throw new Error("This category already exists.")
      }
      setSyncStatus("syncing")
      const id = slugifyCategoryId(trimmed)
      const color = CHART_FILLS[customCategories.length % CHART_FILLS.length]
      await masterPlanService.addCustomCategory({ id, name: trimmed, color })
      setSyncStatus("synced")
      return id
    },
    [allCategories, customCategories.length]
  )

  const updateCustomCategory = useCallback(
    async (id: string, name: string) => {
      const trimmed = name.trim()
      if (!trimmed) throw new Error("Please enter a category name.")
      if (isDuplicateCategoryNameExcept(trimmed, allCategories, id)) {
        throw new Error("This category name already exists.")
      }
      setSyncStatus("syncing")
      await masterPlanService.updateCustomCategory(id, trimmed)
      setSyncStatus("synced")
    },
    [allCategories]
  )

  const deleteCustomCategory = useCallback(
    async (id: string) => {
      const inUse = items.some((item) => item.category === id)
      if (inUse) {
        throw new Error("Cannot delete — items are using this category.")
      }
      setSyncStatus("syncing")
      await masterPlanService.deleteCustomCategory(id)
      setSyncStatus("synced")
    },
    [items]
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
    customCategories,
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
