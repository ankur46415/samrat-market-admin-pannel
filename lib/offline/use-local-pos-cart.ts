"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { findCachedProductByBarcode, normalizeScannedBarcode, type BarcodeProductRef } from "@/lib/stock"
import { clampDiscountPercent, lineItemAmount, mrpLineSaved } from "@/lib/billing/line-discount"
import type { EditableLiveItem } from "@/components/live-billing/live-bill-items-editor"
import type { LiveBillingLineItem } from "@/lib/features/live_billing_admin/services/live_billing_admin_service"
import { idbDelete, idbGet, idbPut, STORE_KV } from "./idb"
import { lookupProductFromIdb } from "./product-cache"

function cartKey(sessionId: string) {
  return `offline-cart:${sessionId}`
}

function toLineItems(items: EditableLiveItem[]): LiveBillingLineItem[] {
  return items.map((item) => ({
    barcode: item.barcode,
    name: item.name,
    price: item.price,
    quantity: item.quantity,
    discountPercent: item.discountPercent,
    ...(item.mrp && item.mrp > 0 ? { mrp: item.mrp } : {}),
  }))
}

export function useLocalPosCart(active: boolean, sessionId: string | null) {
  const [items, setItems] = useState<EditableLiveItem[]>([])
  const [loading, setLoading] = useState(true)
  const persistTimer = useRef<number | null>(null)

  useEffect(() => {
    if (!active || !sessionId) {
      setItems([])
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    void idbGet<EditableLiveItem[]>(STORE_KV, cartKey(sessionId))
      .then((saved) => {
        if (!cancelled) setItems(Array.isArray(saved) ? saved : [])
      })
      .catch(() => {
        if (!cancelled) setItems([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [active, sessionId])

  useEffect(() => {
    if (!active || !sessionId || loading) return
    if (persistTimer.current) window.clearTimeout(persistTimer.current)
    persistTimer.current = window.setTimeout(() => {
      void idbPut(STORE_KV, items, cartKey(sessionId))
    }, 200)
    return () => {
      if (persistTimer.current) window.clearTimeout(persistTimer.current)
    }
  }, [active, items, loading, sessionId])

  const scanProduct = useCallback(async (barcode: string, productCache: BarcodeProductRef[]) => {
    const cleaned = normalizeScannedBarcode(barcode)
    let product = findCachedProductByBarcode(productCache, cleaned)
    if (!product) {
      product = await lookupProductFromIdb(cleaned)
    }
    if (!product) {
      throw new Error(`Product not found for barcode: ${cleaned || barcode.trim()}`)
    }
    const resolvedBarcode = normalizeScannedBarcode(product.barcode ?? "") || product.id
    const name = product.name
    const price = product.price
    const mrp = product.mrp && product.mrp > 0 ? product.mrp : undefined

    let nextQty = 1
    setItems((prev) => {
      const existing = prev.find((row) => row.barcode === resolvedBarcode || row.itemDocId === resolvedBarcode)
      if (existing) {
        nextQty = existing.quantity + 1
        return prev.map((row) =>
          row.itemDocId === existing.itemDocId ? { ...row, quantity: nextQty } : row
        )
      }
      const line: EditableLiveItem = {
        itemDocId: resolvedBarcode.replace(/[/\\]/g, "_"),
        barcode: resolvedBarcode,
        name,
        price,
        quantity: 1,
        discountPercent: 0,
        ...(mrp ? { mrp } : {}),
      }
      return [...prev, line]
    })
    return {
      barcode: resolvedBarcode,
      name,
      price,
      quantity: nextQty,
      ...(mrp ? { mrp } : {}),
    } satisfies LiveBillingLineItem
  }, [])

  const addManual = useCallback(async (input: { name: string; quantity: number; price: number; discountPercent?: number }) => {
    const name = input.name.trim()
    if (!name) throw new Error("Product name is required")
    const quantity = Math.max(1, Math.floor(Number(input.quantity) || 0))
    const price = Math.max(0, Number(input.price))
    const discountPercent = clampDiscountPercent(input.discountPercent ?? 0)
    const barcode = `OTHER-${Date.now().toString(36).toUpperCase()}`
    const line: EditableLiveItem = {
      itemDocId: `manual_${Date.now().toString(36)}`,
      barcode,
      name,
      price,
      quantity,
      discountPercent,
    }
    setItems((prev) => [...prev, line])
    return {
      barcode,
      name,
      price,
      quantity,
      discountPercent,
    } satisfies LiveBillingLineItem
  }, [])

  const removeItem = useCallback(async (itemDocId: string) => {
    setItems((prev) => prev.filter((row) => row.itemDocId !== itemDocId))
  }, [])

  const updateQuantity = useCallback(async (itemDocId: string, quantity: number) => {
    const nextQty = Math.floor(quantity)
    if (nextQty <= 0) {
      setItems((prev) => prev.filter((row) => row.itemDocId !== itemDocId))
      return
    }
    setItems((prev) => prev.map((row) => (row.itemDocId === itemDocId ? { ...row, quantity: nextQty } : row)))
  }, [])

  const updatePrice = useCallback(async (itemDocId: string, price: number) => {
    const nextPrice = Math.max(0, Number(price))
    if (!Number.isFinite(nextPrice)) throw new Error("Invalid price")
    setItems((prev) => prev.map((row) => (row.itemDocId === itemDocId ? { ...row, price: nextPrice } : row)))
  }, [])

  const updateDiscount = useCallback(async (itemDocId: string, discountPercent: number) => {
    const next = clampDiscountPercent(discountPercent)
    setItems((prev) =>
      prev.map((row) => (row.itemDocId === itemDocId ? { ...row, discountPercent: next } : row))
    )
  }, [])

  const clearCart = useCallback(async () => {
    setItems([])
    if (sessionId) await idbDelete(STORE_KV, cartKey(sessionId))
  }, [sessionId])

  const totals = useMemo(() => {
    const lines = items.length
    const qty = items.reduce((sum, i) => sum + i.quantity, 0)
    const total = items.reduce(
      (sum, i) => sum + lineItemAmount(i.quantity, i.price, i.discountPercent),
      0
    )
    const discountSaved = items.reduce(
      (sum, i) => sum + i.quantity * i.price - lineItemAmount(i.quantity, i.price, i.discountPercent),
      0
    )
    const mrpSaved = items.reduce(
      (sum, i) => sum + mrpLineSaved(i.quantity, i.mrp ?? 0, i.price, i.discountPercent),
      0
    )
    return { lines, qty, total, discountSaved, mrpSaved }
  }, [items])

  return {
    items,
    loading,
    totals,
    lineItems: toLineItems(items),
    scanProduct,
    addManual,
    removeItem,
    updateQuantity,
    updatePrice,
    updateDiscount,
    clearCart,
  }
}
