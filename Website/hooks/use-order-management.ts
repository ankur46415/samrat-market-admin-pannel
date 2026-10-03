"use client"

import { useCallback, useEffect, useState } from "react"
import { useAccountModeScope } from "@/components/account-mode-provider"
import type { OrderMgmtGroup, OrderMgmtItem, OrderMgmtOrder } from "@/lib/features/order-management/models"
import {
  addOrderMgmtGroup,
  deleteOrderMgmtGroup,
  subscribeOrderMgmtGroups,
  updateOrderMgmtGroup,
} from "@/lib/features/order-management/service"

export type CatalogSyncStatus = "connecting" | "synced" | "error" | "offline"

export function useOrderManagement() {
  const accountMode = useAccountModeScope()
  const [groups, setGroups] = useState<OrderMgmtGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [syncStatus, setSyncStatus] = useState<CatalogSyncStatus>("connecting")

  useEffect(() => {
    setSyncStatus("connecting")
    const unsub = subscribeOrderMgmtGroups(
      (data) => {
        setGroups(data)
        setLoading(false)
        setSyncStatus("synced")
      },
      () => {
        setLoading(false)
        setSyncStatus("error")
      }
    )
    return () => unsub()
  }, [accountMode])

  const createGroup = useCallback(async (name: string, source: string, color: string) => {
    await addOrderMgmtGroup({ name, source, color, items: [], orders: [] })
  }, [])

  const updateGroupMeta = useCallback(async (id: string, name: string, source: string, color: string) => {
    await updateOrderMgmtGroup(id, { name, source, color })
  }, [])

  const updateGroupItems = useCallback(async (id: string, items: OrderMgmtItem[]) => {
    await updateOrderMgmtGroup(id, { items })
  }, [])

  const updateGroupOrders = useCallback(async (id: string, orders: OrderMgmtOrder[]) => {
    await updateOrderMgmtGroup(id, { orders })
  }, [])

  const removeGroup = useCallback(async (id: string) => {
    await deleteOrderMgmtGroup(id)
  }, [])

  return {
    groups,
    loading,
    syncStatus,
    createGroup,
    updateGroupMeta,
    updateGroupItems,
    updateGroupOrders,
    removeGroup,
  }
}
