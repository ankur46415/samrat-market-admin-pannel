"use client"

import { useEffect, useState, useCallback } from "react"
import type { GstPurchaseCatalog, GstCatalogProduct, GstCatalogOrder, GstSaleRecordPercents } from "@/lib/features/gst-purchase-catalog/models"
import { DEFAULT_GST_PERCENTS, DEFAULT_SALE_MARGIN_PERCENTS } from "@/lib/features/gst-purchase-catalog/models"
import {
  subscribeGstPurchaseCatalogs,
  addGstPurchaseCatalog,
  updateGstPurchaseCatalog,
  deleteGstPurchaseCatalog,
  subscribeGstPercents,
  saveGstPercents,
  subscribeGstSaleMarginPercents,
  saveGstSaleMarginPercents,
  subscribeGstSaleRecordPercents,
  saveGstSaleRecordPercents,
} from "@/lib/features/gst-purchase-catalog/service"

export type CatalogSyncStatus = "connecting" | "synced" | "error" | "offline"

export function useGstPurchaseCatalog() {
  const [catalogs, setCatalogs] = useState<GstPurchaseCatalog[]>([])
  const [loading, setLoading] = useState(true)
  const [syncStatus, setSyncStatus] = useState<CatalogSyncStatus>("connecting")
  const [gstPercents, setGstPercents] = useState<number[]>([...DEFAULT_GST_PERCENTS])
  const [saleMarginPercents, setSaleMarginPercents] = useState<number[]>([...DEFAULT_SALE_MARGIN_PERCENTS])
  const [gstSaleRecordPercents, setGstSaleRecordPercents] = useState<GstSaleRecordPercents>({})

  useEffect(() => {
    setSyncStatus("connecting")
    const unsub = subscribeGstPurchaseCatalogs(
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

  useEffect(() => {
    const unsub = subscribeGstPercents(setGstPercents)
    return () => unsub()
  }, [])

  useEffect(() => {
    const unsub = subscribeGstSaleMarginPercents(setSaleMarginPercents)
    return () => unsub()
  }, [])

  useEffect(() => {
    const unsub = subscribeGstSaleRecordPercents(setGstSaleRecordPercents)
    return () => unsub()
  }, [])

  const updateGstPercents = useCallback(async (next: number[]) => {
    await saveGstPercents(next)
  }, [])

  const updateSaleMarginPercents = useCallback(async (next: number[]) => {
    await saveGstSaleMarginPercents(next)
  }, [])

  const updateGstSaleRecordPercents = useCallback(async (next: GstSaleRecordPercents) => {
    await saveGstSaleRecordPercents(next)
  }, [])

  const createCatalog = useCallback(
    async (name: string, source: string, color: string, products: GstCatalogProduct[]) => {
      await addGstPurchaseCatalog({ name, source, color, products, orders: [] })
    },
    []
  )

  const updateCatalogMeta = useCallback(
    async (id: string, name: string, source: string, color: string) => {
      await updateGstPurchaseCatalog(id, { name, source, color })
    },
    []
  )

  const updateCatalogProducts = useCallback(async (id: string, products: GstCatalogProduct[]) => {
    await updateGstPurchaseCatalog(id, { products })
  }, [])

  const updateCatalogOrders = useCallback(async (id: string, orders: GstCatalogOrder[]) => {
    await updateGstPurchaseCatalog(id, { orders })
  }, [])

  const removeCatalog = useCallback(async (id: string) => {
    await deleteGstPurchaseCatalog(id)
  }, [])

  return {
    catalogs,
    loading,
    syncStatus,
    createCatalog,
    updateCatalogMeta,
    updateCatalogProducts,
    updateCatalogOrders,
    removeCatalog,
    gstPercents,
    updateGstPercents,
    saleMarginPercents,
    updateSaleMarginPercents,
    gstSaleRecordPercents,
    updateGstSaleRecordPercents,
  }
}
