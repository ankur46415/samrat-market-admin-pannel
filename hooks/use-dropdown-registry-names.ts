"use client"

import { useEffect, useState } from "react"
import { collection, onSnapshot } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { col } from "@/lib/account-mode"
import { useAccountModeScope } from "@/components/account-mode-provider"

/** Lightweight dropdown names from registry collections (no full products listener). */
export function useDropdownRegistryNames(collectionName: string) {
  const accountMode = useAccountModeScope()
  const [names, setNames] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    const unsub = onSnapshot(
      collection(db, col(collectionName)),
      (snapshot) => {
        const next = snapshot.docs
          .map((d) => String((d.data() as { name?: unknown }).name ?? "").trim())
          .filter(Boolean)
        setNames(
          [...new Set(next)].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }))
        )
        setLoading(false)
      },
      (err) => {
        console.error(`${collectionName} registry error:`, err)
        setLoading(false)
      }
    )
    return () => unsub()
  }, [accountMode, collectionName])

  return { names, loading }
}
