export const MASTER_PLAN_CATEGORIES = [
  { id: "Groceries", name: "Groceries & Staples", color: "#4A5568" },
  { id: "Snacks", name: "Biscuits & Snacks", color: "#DD6B20" },
  { id: "Foods", name: "Foods & Beverages", color: "#3182CE" },
  { id: "Household", name: "Cleaning & Household", color: "#38A169" },
  { id: "Extras", name: "Puja & Personal Care", color: "#805AD5" },
] as const

export type MasterPlanCategoryId = (typeof MASTER_PLAN_CATEGORIES)[number]["id"]

export type MasterPlanCategoryOption = {
  id: string
  name: string
  color: string
  isCustom?: boolean
}

export const MASTER_PLAN_CATEGORY_IDS = MASTER_PLAN_CATEGORIES.map((c) => c.id)

const BUILTIN_CATEGORY_IDS = new Set<string>(MASTER_PLAN_CATEGORY_IDS)

export function slugifyCategoryId(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
  return slug ? `custom-${slug}` : `custom-${Date.now()}`
}

export function mergeMasterPlanCategories(
  custom: Array<{ id: string; name: string; color?: string }>
): MasterPlanCategoryOption[] {
  const builtIn: MasterPlanCategoryOption[] = MASTER_PLAN_CATEGORIES.map((c) => ({
    id: c.id,
    name: c.name,
    color: c.color,
  }))
  const seen = new Set(BUILTIN_CATEGORY_IDS)
  const extras = custom
    .filter((c) => {
      if (seen.has(c.id)) return false
      seen.add(c.id)
      return true
    })
    .map((c) => ({
      id: c.id,
      name: c.name,
      color: c.color ?? "#64748B",
      isCustom: true,
    }))
  return [...builtIn, ...extras]
}

export function masterPlanCategoryName(
  id: string,
  categories: MasterPlanCategoryOption[] = MASTER_PLAN_CATEGORIES as unknown as MasterPlanCategoryOption[]
): string {
  return categories.find((c) => c.id === id)?.name ?? id
}

export function isDuplicateCategoryName(name: string, categories: MasterPlanCategoryOption[]): boolean {
  const normalized = name.trim().toLowerCase()
  return categories.some((c) => c.name.trim().toLowerCase() === normalized)
}

export const MASTER_PLAN_STORE_NAME = "Samrat Supermarket Jaunpur"

export const DEFAULT_MASTER_PLAN_BRANCH = {
  name: MASTER_PLAN_STORE_NAME,
  description: "",
  strategyLabel: "",
  investmentCap: 0,
  isDefault: true,
} as const
