"use client"

import { useCallback, useEffect, useState } from "react"
import type { ProductSupplier, SupplierOrderItem, SupplierOrderItemInput } from "@/lib/features/product-suppliers/models"
import {
  addProductSupplier,
  addSupplierOrderItems,
  deleteProductSupplier,
  deleteSupplierOrderItem,
  deleteSupplierOrderItems,
  subscribeProductSuppliers,
  subscribeSupplierOrderItems,
  updateProductSupplier,
  updateSupplierOrderItem,
} from "@/lib/features/product-suppliers/service"

export type ProductSuppliersSyncStatus = "connecting" | "synced" | "error"

export function useProductSuppliers() {
  const [suppliers, setSuppliers] = useState<ProductSupplier[]>([])
  const [orderItems, setOrderItems] = useState<SupplierOrderItem[]>([])
  const [loading, setLoading] = useState(true)
  const [syncStatus, setSyncStatus] = useState<ProductSuppliersSyncStatus>("connecting")

  useEffect(() => {
    setSyncStatus("connecting")
    let suppliersReady = false
    let itemsReady = false

    const maybeDone = () => {
      if (suppliersReady && itemsReady) {
        setLoading(false)
        setSyncStatus("synced")
      }
    }

    const unsubSuppliers = subscribeProductSuppliers(
      (data) => {
        setSuppliers(data)
        suppliersReady = true
        maybeDone()
      },
      () => setSyncStatus("error")
    )

    const unsubItems = subscribeSupplierOrderItems(
      (data) => {
        setOrderItems(data)
        itemsReady = true
        maybeDone()
      },
      () => setSyncStatus("error")
    )

    return () => {
      unsubSuppliers()
      unsubItems()
    }
  }, [])

  const createSupplier = useCallback(
    async (input: { name: string; phone?: string; email?: string; address?: string; notes?: string }) => {
      await addProductSupplier(input)
    },
    []
  )

  const editSupplier = useCallback(
    async (id: string, input: Partial<Omit<ProductSupplier, "id" | "createdAt" | "updatedAt">>) => {
      await updateProductSupplier(id, input)
    },
    []
  )

  const removeSupplier = useCallback(async (id: string) => {
    await deleteProductSupplier(id)
  }, [])

  const createOrderItems = useCallback(async (items: SupplierOrderItemInput[]) => {
    await addSupplierOrderItems(items)
  }, [])

  const editOrderItem = useCallback(
    async (
      id: string,
      input: Partial<
        Pick<
          SupplierOrderItem,
          | "product"
          | "brand"
          | "buyRate"
          | "mrp"
          | "productId"
          | "discountPercent"
          | "orderDate"
          | "deliveredDate"
          | "supplierId"
          | "supplierName"
          | "orderTag"
        >
      >
    ) => {
      await updateSupplierOrderItem(id, input)
    },
    []
  )

  const removeOrderItem = useCallback(async (id: string) => {
    await deleteSupplierOrderItem(id)
  }, [])

  const removeOrderItems = useCallback(async (ids: string[]) => {
    await deleteSupplierOrderItems(ids)
  }, [])

  return {
    suppliers,
    orderItems,
    loading,
    syncStatus,
    createSupplier,
    editSupplier,
    removeSupplier,
    createOrderItems,
    editOrderItem,
    removeOrderItem,
    removeOrderItems,
  }
}
