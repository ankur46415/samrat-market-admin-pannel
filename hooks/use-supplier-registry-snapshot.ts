"use client"

import { useEffect, useMemo, useState } from "react"
import { collection, onSnapshot } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { col } from "@/lib/account-mode"
import { useAccountModeScope } from "@/components/account-mode-provider"
import {
  contactForSupplierName,
  LEGACY_SUPPLIER_NAMES_COL,
  PRODUCT_SUPPLIER_REGISTRY_COL,
  type SupplierRegistryRow,
} from "@/lib/inventory/supplier-registry"

/** Firestore snapshot of supplier name + contact pairs (includes legacy name-only rows). */
export function useSupplierRegistrySnapshot() {
  const accountMode = useAccountModeScope()
  const [stored, setStored] = useState<SupplierRegistryRow[]>([])
  const [legacyNames, setLegacyNames] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    const unsubRegistry = onSnapshot(
      collection(db, col(PRODUCT_SUPPLIER_REGISTRY_COL)),
      (snapshot) => {
        setStored(
          snapshot.docs
            .map((d) => {
              const data = d.data() as { name?: unknown; contact?: unknown }
              return {
                id: d.id,
                name: String(data.name ?? "").trim(),
                contact: String(data.contact ?? "").trim(),
              }
            })
            .filter((r) => r.name.length > 0)
        )
        setLoading(false)
      },
      (err) => {
        console.error("product_supplier_registry error:", err)
        setLoading(false)
      }
    )

    const unsubLegacy = onSnapshot(
      collection(db, col(LEGACY_SUPPLIER_NAMES_COL)),
      (snapshot) => {
        const next = snapshot.docs
          .map((d) => String((d.data() as { name?: unknown }).name ?? "").trim())
          .filter(Boolean)
        setLegacyNames([...new Set(next)])
      },
      () => setLegacyNames([])
    )

    return () => {
      unsubRegistry()
      unsubLegacy()
    }
  }, [accountMode])

  const entries = useMemo((): SupplierRegistryRow[] => {
    const byName = new Map<string, SupplierRegistryRow>()
    for (const row of stored) {
      byName.set(row.name.toLowerCase(), row)
    }
    for (const name of legacyNames) {
      const key = name.toLowerCase()
      if (!byName.has(key)) {
        byName.set(key, { id: `legacy:${key}`, name, contact: "" })
      }
    }
    return [...byName.values()].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
    )
  }, [stored, legacyNames])

  const names = useMemo(() => entries.map((e) => e.name), [entries])

  const contactForName = useMemo(
    () => (name: string) => contactForSupplierName(name, entries),
    [entries]
  )

  return { entries, names, loading, contactForName, stored, legacyNames }
}
