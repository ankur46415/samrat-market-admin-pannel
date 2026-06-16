import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  MASTER_PLAN_CATEGORIES,
  type MasterPlanCategoryId,
} from "@/lib/features/master-plan/constants"
import type {
  MasterPlanBranch,
  MasterPlanCategoryAggregate,
  MasterPlanItem,
  MasterPlanItemInput,
  MasterPlanStats,
} from "@/lib/features/master-plan/models"
import { masterPlanService } from "@/lib/features/master-plan/services/master_plan_service"

export type SyncStatus = "connecting" | "syncing" | "synced" | "error" | "offline"

function computeStats(items: MasterPlanItem[]): {
  stats: MasterPlanStats
  categories: MasterPlanCategoryAggregate[]
} {
  const categorySums: Record<MasterPlanCategoryId, { cost: number; profit: number }> = {
    Groceries: { cost: 0, profit: 0 },
    Snacks: { cost: 0, profit: 0 },
    Foods: { cost: 0, profit: 0 },
    Household: { cost: 0, profit: 0 },
    Extras: { cost: 0, profit: 0 },
  }

  let totalInvestment = 0
  let grossProfit = 0

  items.forEach((item) => {
    const totalCost = item.whls * item.qty
    const totalProfit = (item.mrp - item.whls) * item.qty
    totalInvestment += totalCost
    grossProfit += totalProfit
    if (categorySums[item.category]) {
      categorySums[item.category].cost += totalCost
      categorySums[item.category].profit += totalProfit
    }
  })

  const categories = MASTER_PLAN_CATEGORIES.map((category) => {
    const sums = categorySums[category.id]
    const revenue = sums.cost + sums.profit
    const margin = revenue > 0 ? (sums.profit / revenue) * 100 : 0
    return {
      ...category,
      cost: sums.cost,
      profit: sums.profit,
      margin: parseFloat(margin.toFixed(1)),
    }
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
  const [activeBranchId, setActiveBranchId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("connecting")
  const [error, setError] = useState<string | null>(null)
  const seedAttempted = useRef(false)

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

  const { stats, categories } = useMemo(() => computeStats(items), [items])

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

  return {
    items,
    loading,
    syncStatus,
    error,
    stats,
    categories,
    addItem,
    updateItem,
    deleteItem,
    adjustQty,
  }
}
