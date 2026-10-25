"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { normalizeScannedBarcode, type BarcodeProductRef } from "@/lib/stock"
import { lookupProductForBilling } from "@/lib/features/live_billing_admin/services/live_billing_admin_service"
import { DRAFT_BILLING_BLOCKED_MESSAGE } from "@/lib/features/inventory/services/draft_product_service"
import { playScanFound, playScanNotFound } from "@/lib/pos-scan-sounds"

export type PosScanResult = {
  name: string
  barcode: string
  quantity: number
  price: number
  discountPercent: number
  mrp?: number
}

export function usePosScanner({
  sessionId,
  productCache,
  enabled = true,
  locked = false,
  lookupItem,
}: {
  sessionId: string | null
  /** Optional in-memory cache; billing scans use direct Firestore barcode queries when omitted. */
  productCache?: BarcodeProductRef[]
  enabled?: boolean
  /** True while a found item is waiting for Add / Remove. */
  locked?: boolean
  lookupItem?: (barcode: string, productCache: BarcodeProductRef[]) => Promise<PosScanResult | null>
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const queueRef = useRef<string[]>([])
  const processingRef = useRef(false)
  const productCacheRef = useRef(productCache ?? [])
  const sessionIdRef = useRef(sessionId)
  const enabledRef = useRef(enabled)
  const lockedRef = useRef(locked)

  productCacheRef.current = productCache ?? []
  sessionIdRef.current = sessionId
  enabledRef.current = enabled
  lockedRef.current = locked

  const [isProcessing, setIsProcessing] = useState(false)
  const [statusMessage, setStatusMessage] = useState("Ready to scan")
  const [statusTone, setStatusTone] = useState<"idle" | "success" | "error" | "processing">("idle")
  const [lastScan, setLastScan] = useState<PosScanResult | null>(null)
  const [lastFailedBarcode, setLastFailedBarcode] = useState<string | null>(null)
  const [notFoundBarcode, setNotFoundBarcode] = useState<string | null>(null)
  const [notFoundKey, setNotFoundKey] = useState(0)
  const [flashKey, setFlashKey] = useState(0)
  const [scanFieldValue, setScanFieldValue] = useState("")

  const clearScanInput = useCallback(() => {
    setScanFieldValue("")
    if (inputRef.current) inputRef.current.value = ""
  }, [])

  const showScanInField = useCallback((raw: string) => {
    const barcode = normalizeScannedBarcode(raw) || raw.trim()
    if (!barcode) return
    setScanFieldValue(barcode)
    if (inputRef.current) inputRef.current.value = barcode
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

  const lookupItemRef = useRef(lookupItem)
  lookupItemRef.current = lookupItem

  const processQueue = useCallback(async () => {
    if (processingRef.current) return

    const activeSessionId = sessionIdRef.current
    if (!activeSessionId) return

    processingRef.current = true
    setIsProcessing(true)
    let holdAfterFind = false
    let holdAfterMiss = false

    try {
      while (queueRef.current.length > 0) {
        const raw = queueRef.current.shift()
        if (!raw) continue

        const barcode = normalizeScannedBarcode(raw)
        if (!barcode) continue

        setStatusTone("processing")
        setStatusMessage(`Scanning ${barcode}…`)

        try {
          const lookupFn = lookupItemRef.current ?? defaultLookupItem
          const item = await lookupFn(barcode, productCacheRef.current)
          if (!item) {
            throw new Error(`Product not found for barcode: ${barcode}`)
          }
          const result: PosScanResult = {
            name: item.name,
            barcode: item.barcode,
            quantity: item.quantity || 1,
            price: item.price,
            discountPercent: item.discountPercent ?? 0,
            ...(item.mrp && item.mrp > 0 ? { mrp: item.mrp } : {}),
          }
          setLastScan(result)
          setLastFailedBarcode(null)
          setNotFoundBarcode(null)
          setFlashKey((k) => k + 1)
          setStatusTone("success")
          setStatusMessage(`Press Enter to add ${item.name} — scan locked`)
          playScanFound()
          lockedRef.current = true
          holdAfterFind = true
          queueRef.current = []
          break
        } catch (e) {
          const msg = e instanceof Error ? e.message : "Scan failed"
          const draftBlocked = msg === DRAFT_BILLING_BLOCKED_MESSAGE
          const notFound = msg.toLowerCase().includes("not found") && !draftBlocked
          if (!notFound && !draftBlocked) console.error(e)
          setLastFailedBarcode(barcode)
          setStatusTone("error")
          setStatusMessage(
            draftBlocked
              ? `✗ ${DRAFT_BILLING_BLOCKED_MESSAGE}`
              : notFound
                ? `✗ Barcode not in inventory: ${barcode}`
                : `✗ ${msg}`
          )
          playScanNotFound()
          if (notFound) {
            setNotFoundBarcode(barcode)
            setNotFoundKey((k) => k + 1)
            lockedRef.current = true
            holdAfterMiss = true
            queueRef.current = []
            break
          }
          toast.error(draftBlocked ? DRAFT_BILLING_BLOCKED_MESSAGE : msg)
        }
      }
    } finally {
      processingRef.current = false
      setIsProcessing(false)
      clearScanInput()
      if (!holdAfterFind && !holdAfterMiss) focusInput()
    }
  }, [clearScanInput, focusInput])

  const enqueueScan = useCallback(
    (raw: string, options?: { explicit?: boolean }) => {
      if (!sessionIdRef.current) return
      if (lockedRef.current) return
      // Camera / programmatic scans while a dialog is open (enabled=false)
      if (!options?.explicit && !enabledRef.current) return
      const barcode = normalizeScannedBarcode(raw)
      if (!barcode) return

      showScanInField(barcode)
      queueRef.current.push(barcode)
      void processQueue()
    },
    [processQueue, showScanInField]
  )

  const submitScan = useCallback(
    (raw?: string) => {
      const value = raw ?? scanFieldValue ?? inputRef.current?.value ?? ""
      if (!value.trim()) return
      enqueueScan(value, { explicit: raw !== undefined && raw.trim().length > 0 })
    },
    [enqueueScan, scanFieldValue]
  )

  /** Clear stuck queue/processing and refocus — use when gun stops responding. */
  const recoverScanner = useCallback(() => {
    queueRef.current = []
    processingRef.current = false
    lockedRef.current = false
    setIsProcessing(false)
    clearScanInput()
    setStatusTone("idle")
    setStatusMessage("Ready to scan")
    setLastScan(null)
    setLastFailedBarcode(null)
    setNotFoundBarcode(null)
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
    scanFieldValue,
    setScanFieldValue,
    submitScan,
    focusInput,
    recoverScanner,
    isProcessing,
    statusMessage,
    statusTone,
    lastScan,
    lastFailedBarcode,
    notFoundBarcode,
    notFoundKey,
    flashKey,
    clearLastScan: () => {
      setLastScan(null)
      setStatusTone("idle")
      setStatusMessage("Ready to scan")
    },
    clearNotFound: () => {
      setNotFoundBarcode(null)
      setLastFailedBarcode(null)
      setStatusTone("idle")
      setStatusMessage("Ready to scan")
      lockedRef.current = false
    },
  }
}

async function defaultLookupItem(barcode: string, cache: BarcodeProductRef[]): Promise<PosScanResult | null> {
  const product = await lookupProductForBilling(barcode, cache.length ? cache : undefined)
  if (!product) return null
  return {
    barcode: product.barcode,
    name: product.name,
    price: product.price,
    quantity: 1,
    discountPercent: product.discountPercent ?? 0,
    ...(product.mrp && product.mrp > 0 ? { mrp: product.mrp } : {}),
  }
}
