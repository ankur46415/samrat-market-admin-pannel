import type { MasterPlanCategoryId } from "@/lib/features/master-plan/constants"
import rawItems from "@/lib/features/master-plan/seed-data.json"

export type MasterPlanSeedItem = {
  category: MasterPlanCategoryId
  name: string
  brand: string
  size: string
  whls: number
  mrp: number
  qty: number
}

export const MASTER_PLAN_SEED_ITEMS = rawItems as MasterPlanSeedItem[]
