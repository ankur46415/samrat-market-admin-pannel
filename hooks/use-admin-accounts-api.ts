"use client"

import { useCallback, useState } from "react"
import { auth } from "@/lib/firebase"
import type { ManagedAccountRecord, CreateManagedAccountInput } from "@/lib/managed-account-types"
import type { AppPermissionId } from "@/lib/app-permissions"

async function adminFetch(path: string, init?: RequestInit) {
  const token = await auth.currentUser?.getIdToken()
  if (!token) throw new Error("Not signed in")
  const res = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init?.headers as Record<string, string> | undefined),
    },
  })
  const data = (await res.json().catch(() => ({}))) as { error?: string; accounts?: ManagedAccountRecord[]; account?: ManagedAccountRecord }
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`)
  return data
}

export function useAdminAccountsApi() {
  const [loading, setLoading] = useState(false)

  const listAccounts = useCallback(async (): Promise<ManagedAccountRecord[]> => {
    setLoading(true)
    try {
      const data = await adminFetch("/api/admin/accounts")
      return data.accounts ?? []
    } finally {
      setLoading(false)
    }
  }, [])

  const createAccount = useCallback(async (input: CreateManagedAccountInput) => {
    setLoading(true)
    try {
      const data = await adminFetch("/api/admin/accounts", {
        method: "POST",
        body: JSON.stringify(input),
      })
      return data.account
    } finally {
      setLoading(false)
    }
  }, [])

  const updateAccount = useCallback(
    async (
      uid: string,
      patch: { permissions?: AppPermissionId[]; password?: string; disabled?: boolean }
    ) => {
      setLoading(true)
      try {
        await adminFetch(`/api/admin/accounts/${uid}`, {
          method: "PATCH",
          body: JSON.stringify(patch),
        })
      } finally {
        setLoading(false)
      }
    },
    []
  )

  const disableAccount = useCallback(async (uid: string) => {
    setLoading(true)
    try {
      await adminFetch(`/api/admin/accounts/${uid}`, { method: "DELETE" })
    } finally {
      setLoading(false)
    }
  }, [])

  return { loading, listAccounts, createAccount, updateAccount, disableAccount }
}
