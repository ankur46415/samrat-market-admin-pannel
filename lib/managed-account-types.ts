import type { AppPermissionId } from "@/lib/app-permissions"

export type ManagedAccountRecord = {
  uid: string
  username: string
  accountTag: string
  email: string
  role: "admin" | "staff" | "employee" | "scanner"
  permissions: AppPermissionId[]
  disabled?: boolean
  requiresAccessCode?: boolean
  createdAt?: string
  updatedAt?: string
}

export type CreateManagedAccountInput = {
  username: string
  password: string
  permissions: AppPermissionId[]
}
