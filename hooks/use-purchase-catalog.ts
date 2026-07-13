"use client"

import { useEffect, useState, useCallback } from "react"
import type { PurchaseCatalog, CatalogProduct } from "@/lib/features/purchase-catalog/models"
import {
  subscribePurchaseCatalogs,
  addPurchaseCatalog,
  updatePurchaseCatalog,
  deletePurchaseCatalog,
} from "@/lib/features/purchase-catalog/service"

export type CatalogSyncStatus = "connecting" | "synced" | "error" | "offline"

export function usePurchaseCatalog() {
  const [catalogs, setCatalogs] = useState<PurchaseCatalog[]>([])
  const [loading, setLoading] = useState(true)
  const [syncStatus, setSyncStatus] = useState<CatalogSyncStatus>("connecting")

  useEffect(() => {
    setSyncStatus("connecting")
    const unsub = subscribePurchaseCatalogs(
      (data) => {
        setCatalogs(data)
        setLoading(false)
        setSyncStatus("synced")
      },
      () => {
        setLoading(false)
        setSyncStatus("error")
      }
    )
    return () => unsub()
  }, [])

  const createCatalog = useCallback(
    async (name: string, source: string, color: string, products: CatalogProduct[]) => {
      await addPurchaseCatalog({ name, source, color, products })
    },
    []
  )

  const updateCatalogMeta = useCallback(
    async (id: string, name: string, source: string, color: string) => {
      await updatePurchaseCatalog(id, { name, source, color })
    },
    []
  )

  const updateCatalogProducts = useCallback(
    async (id: string, products: CatalogProduct[]) => {
      await updatePurchaseCatalog(id, { products })
    },
    []
  )

  const removeCatalog = useCallback(async (id: string) => {
    await deletePurchaseCatalog(id)
  }, [])

  return {
    catalogs,
    loading,
    syncStatus,
    createCatalog,
    updateCatalogMeta,
    updateCatalogProducts,
    removeCatalog,
  }
}
