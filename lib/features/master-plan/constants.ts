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

export function branchCategoriesToOptions(
  categories: Array<{ id: string; name: string; color: string }>
): MasterPlanCategoryOption[] {
  return categories.map((c) => ({
    id: c.id,
    name: c.name,
    color: c.color,
    isCustom: true,
  }))
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

export function isDuplicateCategoryNameExcept(
  name: string,
  categories: MasterPlanCategoryOption[],
  exceptId: string
): boolean {
  const normalized = name.trim().toLowerCase()
  return categories.some(
    (c) => c.id !== exceptId && c.name.trim().toLowerCase() === normalized
  )
}

export function isBuiltinCategoryId(id: string): boolean {
  return BUILTIN_CATEGORY_IDS.has(id)
}

export function isDuplicateBranchName(
  name: string,
  branches: Array<{ id: string; name: string }>,
  exceptId?: string
): boolean {
  const normalized = name.trim().toLowerCase()
  return branches.some(
    (b) => b.id !== exceptId && b.name.trim().toLowerCase() === normalized
  )
}

export const DEFAULT_MASTER_PLAN_BRANCH = {
  name: "Rashan",
  description: "",
  strategyLabel: "",
  investmentCap: 0,
  isDefault: true,
} as const
