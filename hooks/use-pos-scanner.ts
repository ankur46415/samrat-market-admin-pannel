"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { normalizeScannedBarcode } from "@/lib/stock"
import { scanItemIntoSession } from "@/lib/features/live_billing_admin/services/live_billing_admin_service"
import type { BarcodeProductRef } from "@/lib/stock"

export type PosScanResult = {
  name: string
  barcode: string
  quantity: number
  price: number
}

export function usePosScanner({
  sessionId,
  productCache,
  enabled = true,
}: {
  sessionId: string | null
  productCache: BarcodeProductRef[]
  enabled?: boolean
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const queueRef = useRef<string[]>([])
  const processingRef = useRef(false)
  const productCacheRef = useRef(productCache)
  const sessionIdRef = useRef(sessionId)
  const enabledRef = useRef(enabled)

  productCacheRef.current = productCache
  sessionIdRef.current = sessionId
  enabledRef.current = enabled

  const [isProcessing, setIsProcessing] = useState(false)
  const [statusMessage, setStatusMessage] = useState("Ready to scan")
  const [statusTone, setStatusTone] = useState<"idle" | "success" | "error" | "processing">("idle")
  const [lastScan, setLastScan] = useState<PosScanResult | null>(null)
  const [lastFailedBarcode, setLastFailedBarcode] = useState<string | null>(null)
  const [flashKey, setFlashKey] = useState(0)

  const clearScanInput = useCallback(() => {
    if (inputRef.current) inputRef.current.value = ""
  }, [])

  const focusInput = useCallback(() => {
    if (!enabledRef.current) return
    requestAnimationFrame(() => {
      const input = inputRef.current
      if (!input || input.disabled) return
      input.focus()
      const len = input.value.length
      input.setSelectionRange(len, len)
    })
  }, [])

  const processQueue = useCallback(async () => {
    if (processingRef.current) return

    const activeSessionId = sessionIdRef.current
    if (!activeSessionId || !enabledRef.current) return

    processingRef.current = true
    setIsProcessing(true)

    try {
      while (queueRef.current.length > 0) {
        const raw = queueRef.current.shift()
        if (!raw) continue

        const barcode = normalizeScannedBarcode(raw)
        if (!barcode) continue

        setStatusTone("processing")
        setStatusMessage(`Scanning ${barcode}…`)

        try {
          const item = await scanItemIntoSession(
            activeSessionId,
            barcode,
            productCacheRef.current
          )
          const result: PosScanResult = {
            name: item.name,
            barcode: item.barcode,
            quantity: item.quantity,
            price: item.price,
          }
          setLastScan(result)
          setLastFailedBarcode(null)
          setFlashKey((k) => k + 1)
          setStatusTone("success")
          setStatusMessage(
            `✓ ${item.name} — Qty ${item.quantity} × ₹${item.price.toLocaleString("en-IN")}`
          )
        } catch (e) {
          console.error(e)
          const msg = e instanceof Error ? e.message : "Scan failed"
          setLastFailedBarcode(barcode)
          setStatusTone("error")
          setStatusMessage(
            msg.includes("not found") ? `✗ Barcode not in inventory: ${barcode}` : `✗ ${msg}`
          )
        }
      }
    } finally {
      processingRef.current = false
      setIsProcessing(false)
      clearScanInput()
      focusInput()
    }
  }, [clearScanInput, focusInput])

  const enqueueScan = useCallback(
    (raw: string) => {
      if (!enabledRef.current || !sessionIdRef.current) return
      const barcode = normalizeScannedBarcode(raw)
      if (!barcode) return

      queueRef.current.push(barcode)
      clearScanInput()
      void processQueue()
    },
    [clearScanInput, processQueue]
  )

  const submitScan = useCallback(
    (raw?: string) => {
      const value = raw ?? inputRef.current?.value ?? ""
      if (!value.trim()) return
      enqueueScan(value)
    },
    [enqueueScan]
  )

  /** Clear stuck queue/processing and refocus — use when gun stops responding. */
  const recoverScanner = useCallback(() => {
    queueRef.current = []
    processingRef.current = false
    setIsProcessing(false)
    clearScanInput()
    setStatusTone("idle")
    setStatusMessage("Ready to scan")
    focusInput()
  }, [clearScanInput, focusInput])

  // Keep scan input focused for barcode gun (unless user is in another field/dialog).
  useEffect(() => {
    if (!enabled) return

    const refocusIfNeeded = () => {
      const active = document.activeElement
      if (active?.closest('[role="dialog"]')) return
      if (active === inputRef.current) return
      if (active?.tagName === "INPUT" || active?.tagName === "TEXTAREA" || active?.tagName === "SELECT") {
        return
      }
      focusInput()
    }

    const intervalId = window.setInterval(refocusIfNeeded, 2500)
    const onVisibility = () => {
      if (document.visibilityState === "visible") refocusIfNeeded()
    }
    document.addEventListener("visibilitychange", onVisibility)

    return () => {
      window.clearInterval(intervalId)
      document.removeEventListener("visibilitychange", onVisibility)
    }
  }, [enabled, focusInput])

  return {
    inputRef,
    submitScan,
    focusInput,
    recoverScanner,
    isProcessing,
    statusMessage,
    statusTone,
    lastScan,
    lastFailedBarcode,
    flashKey,
  }
}
