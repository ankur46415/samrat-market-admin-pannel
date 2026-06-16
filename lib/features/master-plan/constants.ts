export const MASTER_PLAN_CATEGORIES = [
  { id: "Groceries", name: "Groceries & Staples", color: "#4A5568" },
  { id: "Snacks", name: "Biscuits & Snacks", color: "#DD6B20" },
  { id: "Foods", name: "Foods & Beverages", color: "#3182CE" },
  { id: "Household", name: "Cleaning & Household", color: "#38A169" },
  { id: "Extras", name: "Puja & Personal Care", color: "#805AD5" },
] as const

export type MasterPlanCategoryId = (typeof MASTER_PLAN_CATEGORIES)[number]["id"]

export const MASTER_PLAN_CATEGORY_IDS = MASTER_PLAN_CATEGORIES.map((c) => c.id)

export function masterPlanCategoryName(id: string): string {
  return MASTER_PLAN_CATEGORIES.find((c) => c.id === id)?.name ?? id
}

export const DEFAULT_MASTER_PLAN_BRANCH = {
  name: "UP Rural Supermarket",
  description: "Master Opening Stock Planner — ₹8 Lakh General Store Blueprint",
  strategyLabel: "Strategy: ₹8 Lakh Cap (87 High-Variety Items)",
  investmentCap: 800000,
  isDefault: true,
} as const
