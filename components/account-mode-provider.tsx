"use client"

import { createContext, useContext, useMemo, useSyncExternalStore, type ReactNode } from "react"
import {
  getAccountMode,
  setAccountMode,
  subscribeAccountMode,
  type AccountMode,
} from "@/lib/account-mode"

type AccountModeContextValue = {
  mode: AccountMode
  applyMode: (next: AccountMode) => void
}

const AccountModeContext = createContext<AccountModeContextValue | null>(null)

function getServerSnapshot(): AccountMode {
  return "test"
}

export function AccountModeProvider({ children }: { children: ReactNode }) {
  const mode = useSyncExternalStore(subscribeAccountMode, getAccountMode, getServerSnapshot)
  const value = useMemo<AccountModeContextValue>(
    () => ({
      mode,
      applyMode: (next: AccountMode) => {
        if (next === getAccountMode()) return
        setAccountMode(next)
      },
    }),
    [mode]
  )

  return <AccountModeContext.Provider value={value}>{children}</AccountModeContext.Provider>
}

export function useAccountMode(): AccountModeContextValue {
  const ctx = useContext(AccountModeContext)
  if (!ctx) {
    throw new Error("useAccountMode must be used within AccountModeProvider")
  }
  return ctx
}

export function useAccountModeScope(): AccountMode {
  return useSyncExternalStore(subscribeAccountMode, getAccountMode, getServerSnapshot)
}

/** Remounts pages and header so Firestore listeners pick up the new account. */
export function AccountModeDataRoot({ children }: { children: ReactNode }) {
  const { mode } = useAccountMode()
  return (
    <div key={mode} className="contents">
      {children}
    </div>
  )
}
