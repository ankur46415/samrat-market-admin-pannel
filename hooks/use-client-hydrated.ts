"use client"

import { useEffect, useState } from "react"

/** True after the first client paint — use before reading localStorage or other browser-only state in UI. */
export function useClientHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false)
  useEffect(() => {
    setHydrated(true)
  }, [])
  return hydrated
}
