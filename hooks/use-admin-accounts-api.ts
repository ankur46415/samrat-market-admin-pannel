"use client"

import { useCallback, useMemo, useState } from "react"
import { auth } from "@/lib/firebase"
import {
  createAccountClient,
  listAccountsClient,
  updateAccountClient,
} from "@/lib/client-accounts"
import type { ManagedAccountRecord, CreateManagedAccountInput } from "@/lib/managed-account-types"
import type { AppPermissionId } from "@/lib/app-permissions"

class ServerNotConfigured extends Error {}

async function adminFetch(path: string, init?: RequestInit, retried = false): Promise<{
  error?: string
  accounts?: ManagedAccountRecord[]
  account?: ManagedAccountRecord
}> {
  await auth.authStateReady()
  const user = auth.currentUser
  if (!user) throw new Error("Not signed in. Log in again.")
  const token = await user.getIdToken(retried)
  const res = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init?.headers as Record<string, string> | undefined),
    },
  })
  const data = (await res.json().catch(() => ({}))) as {
    error?: string
    accounts?: ManagedAccountRecord[]
    account?: ManagedAccountRecord
  }
  if (res.status === 503 || (data.error || "").includes("FIREBASE_SERVICE_ACCOUNT_JSON")) {
    throw new ServerNotConfigured(data.error || "Server account key is not set.")
  }
  if (res.status === 401 && !retried) return adminFetch(path, init, true)
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`)
  return data
}

let serverReady: boolean | null = null

async function withFallback<T>(server: () => Promise<T>, client: () => Promise<T>): Promise<T> {
  if (serverReady === false) return client()
  try {
    const result = await server()
    serverReady = true
    return result
  } catch (e) {
    if (e instanceof ServerNotConfigured) {
      serverReady = false
      return client()
    }
    throw e
  }
}

export function useAdminAccountsApi() {
  const [loading, setLoading] = useState(false)
  const [usingFallback, setUsingFallback] = useState(false)

  const run = useCallback(async <T,>(server: () => Promise<T>, client: () => Promise<T>) => {
    setLoading(true)
    try {
      return await withFallback(server, async () => {
        setUsingFallback(true)
        return client()
      })
    } finally {
      setLoading(false)
    }
  }, [])

  const listAccounts = useCallback(
    () =>
      run(
        async () => (await adminFetch("/api/admin/accounts")).accounts ?? [],
        listAccountsClient
      ),
    [run]
  )

  const createAccount = useCallback(
    (input: CreateManagedAccountInput) =>
      run(
        async () =>
          (
            await adminFetch("/api/admin/accounts", {
              method: "POST",
              body: JSON.stringify(input),
            })
          ).account,
        () => createAccountClient(input)
      ),
    [run]
  )

  const updateAccount = useCallback(
    (
      uid: string,
      patch: { permissions?: AppPermissionId[]; password?: string; disabled?: boolean; requiresAccessCode?: boolean }
    ) =>
      run(
        async () => {
          await adminFetch(`/api/admin/accounts/${uid}`, {
            method: "PATCH",
            body: JSON.stringify(patch),
          })
        },
        () => updateAccountClient(uid, patch)
      ),
    [run]
  )

  const disableAccount = useCallback(
    (uid: string) =>
      run(
        async () => {
          await adminFetch(`/api/admin/accounts/${uid}`, { method: "DELETE" })
        },
        () => updateAccountClient(uid, { disabled: true })
      ),
    [run]
  )

  return useMemo(
    () => ({ loading, usingFallback, listAccounts, createAccount, updateAccount, disableAccount }),
    [loading, usingFallback, listAccounts, createAccount, updateAccount, disableAccount]
  )
}
