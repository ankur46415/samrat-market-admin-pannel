"use client"

import { useCallback, useRef, useState } from "react"
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

  const [scanValue, setScanValue] = useState("")
  const [isProcessing, setIsProcessing] = useState(false)
  const [statusMessage, setStatusMessage] = useState("Ready to scan")
  const [statusTone, setStatusTone] = useState<"idle" | "success" | "error" | "processing">("idle")
  const [lastScan, setLastScan] = useState<PosScanResult | null>(null)
  const [lastFailedBarcode, setLastFailedBarcode] = useState<string | null>(null)
  const [flashKey, setFlashKey] = useState(0)

  const focusInput = useCallback(() => {
    if (!enabled) return
    requestAnimationFrame(() => inputRef.current?.focus())
  }, [enabled])

  const processQueue = useCallback(async () => {
    if (processingRef.current || !sessionId || !enabled) return
    processingRef.current = true
    setIsProcessing(true)

    while (queueRef.current.length > 0) {
      const raw = queueRef.current.shift()
      if (!raw) continue

      const barcode = normalizeScannedBarcode(raw)
      if (!barcode) continue

      setStatusTone("processing")
      setStatusMessage(`Scanning ${barcode}…`)

      try {
        const item = await scanItemIntoSession(sessionId, barcode, productCache)
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
        setStatusMessage(`✓ ${item.name} — Qty ${item.quantity} × ₹${item.price.toLocaleString("en-IN")}`)
      } catch (e) {
        console.error(e)
        const msg = e instanceof Error ? e.message : "Scan failed"
        setLastFailedBarcode(barcode)
        setStatusTone("error")
        setStatusMessage(msg.includes("not found") ? `✗ Barcode not in inventory: ${barcode}` : `✗ ${msg}`)
      }
    }

    processingRef.current = false
    setIsProcessing(false)
    setScanValue("")
    focusInput()
  }, [enabled, focusInput, productCache, sessionId])

  const enqueueScan = useCallback(
    (raw: string) => {
      if (!enabled || !sessionId) return
      const barcode = normalizeScannedBarcode(raw)
      if (!barcode) return

      queueRef.current.push(barcode)
      setScanValue("")
      void processQueue()
    },
    [enabled, processQueue, sessionId]
  )

  const submitScan = useCallback(
    (raw?: string) => {
      const value = raw ?? inputRef.current?.value ?? scanValue
      enqueueScan(value)
    },
    [enqueueScan, scanValue]
  )

  return {
    inputRef,
    scanValue,
    setScanValue,
    submitScan,
    focusInput,
    isProcessing,
    statusMessage,
    statusTone,
    lastScan,
    lastFailedBarcode,
    flashKey,
  }
}
