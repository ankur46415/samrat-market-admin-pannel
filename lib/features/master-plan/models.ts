import type { MasterPlanCategoryId } from "@/lib/features/master-plan/constants"

export interface MasterPlanBranch {
  id: string
  name: string
  description: string
  strategyLabel: string
  investmentCap: number
  isDefault: boolean
  createdAt: Date
  updatedAt: Date
}

export interface MasterPlanItem {
  id: string
  branchId: string
  category: MasterPlanCategoryId
  name: string
  brand: string
  size: string
  whls: number
  mrp: number
  qty: number
  sortOrder: number
  createdAt: Date
  updatedAt: Date
}

export type MasterPlanItemInput = Omit<
  MasterPlanItem,
  "id" | "branchId" | "sortOrder" | "createdAt" | "updatedAt"
>

export interface MasterPlanCategoryAggregate {
  id: MasterPlanCategoryId
  name: string
  color: string
  cost: number
  profit: number
  margin: number
}

export interface MasterPlanStats {
  totalInvestment: number
  grossProfit: number
  weightedMargin: number
  itemCount: number
}
