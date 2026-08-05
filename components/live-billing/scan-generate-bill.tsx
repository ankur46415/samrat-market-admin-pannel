"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, Loader2, ScanBarcode, Wifi } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AdminSessionItems } from "@/components/live-billing/admin-session-items"
import { useSessionUser } from "@/lib/auth-session"
import { useProducts } from "@/hooks/use-firestore"
import { normalizeScannedBarcode } from "@/lib/stock"
import {
  cancelLiveBillingSession,
  getOrCreateScannerBillingSession,
  scanItemIntoSession,
} from "@/lib/features/live_billing_admin/services/live_billing_admin_service"

export function ScanGenerateBill() {
  const router = useRouter()
  const { user } = useSessionUser()
  const { products, loading: productsLoading } = useProducts()
  const scanInputRef = useRef<HTMLInputElement>(null)
  const scanningRef = useRef(false)

  const [sessionId, setSessionId] = useState<string | null>(null)
  const [creatingSession, setCreatingSession] = useState(true)
  const [scanValue, setScanValue] = useState("")
  const [lastScan, setLastScan] = useState<{ name: string; barcode: string } | null>(null)
  const [acting, setActing] = useState(false)

  const focusScannerInput = useCallback(() => {
    scanInputRef.current?.focus()
  }, [])

  useEffect(() => {
    let cancelled = false

    async function initSession() {
      try {
        setCreatingSession(true)
        const id = await getOrCreateScannerBillingSession(
          user?.name || user?.email || "Admin Scanner"
        )
        if (!cancelled) setSessionId(id)
      } catch (e) {
        console.error(e)
        toast.error("Failed to start scanner session")
      } finally {
        if (!cancelled) setCreatingSession(false)
      }
    }

    initSession()
    return () => {
      cancelled = true
    }
    // One session per scan flow — do not recreate when user profile loads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!sessionId || creatingSession) return

    focusScannerInput()
    const interval = setInterval(focusScannerInput, 1500)
    window.addEventListener("click", focusScannerInput)

    return () => {
      clearInterval(interval)
      window.removeEventListener("click", focusScannerInput)
    }
  }, [creatingSession, focusScannerInput, sessionId])

  const handleScan = async (rawBarcode: string) => {
    const barcode = normalizeScannedBarcode(rawBarcode)
    if (!barcode || !sessionId || scanningRef.current) return

    scanningRef.current = true
    setScanValue("")

    try {
      const item = await scanItemIntoSession(
        sessionId,
        barcode,
        products.map((p) => ({
          id: p.id,
          name: p.name,
          price: p.price,
          barcode: p.barcode,
        }))
      )
      setLastScan({ name: item.name, barcode: item.barcode })
      toast.success(`${item.name} added (qty ${item.quantity})`)
    } catch (e) {
      console.error(e)
      const msg = e instanceof Error ? e.message : "Scan failed"
      if (msg.includes("Product not found")) {
        toast.error(`${msg}. Add this barcode in Inventory first.`, {
          action: {
            label: "Add Product",
            onClick: () =>
              router.push(`/inventory/add?barcode=${encodeURIComponent(barcode)}`),
          },
        })
      } else {
        toast.error(msg)
      }
    } finally {
      scanningRef.current = false
      focusScannerInput()
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    void handleScan(scanValue)
  }

  const handleCheckout = () => {
    if (!sessionId) return
    router.push(`/generate-bill/checkout?sessionId=${encodeURIComponent(sessionId)}`)
  }

  const handleCancel = async () => {
    if (!sessionId) {
      router.push("/generate-bill")
      return
    }

    const ok = window.confirm("Cancel this scan session? All scanned items will be discarded.")
    if (!ok) return

    try {
      setActing(true)
      await cancelLiveBillingSession(sessionId)
      toast.success("Scan session cancelled")
      router.push("/generate-bill")
    } catch (e) {
      console.error(e)
      toast.error("Failed to cancel session")
    } finally {
      setActing(false)
    }
  }

  if (creatingSession || !sessionId || productsLoading) {
    return (
      <div className="flex min-h-[320px] items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin" />
          <p className="text-sm font-medium">
            {creatingSession ? "Starting scanner session…" : "Loading inventory…"}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/generate-bill">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Scan &amp; Generate Bill</h1>
            <p className="text-muted-foreground">
              Use USB or Bluetooth barcode gun — scanner works like a keyboard.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Badge variant="outline" className="gap-1.5 px-3 py-1.5">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            Scanner Ready
          </Badge>
          <Badge variant="secondary">Session: {sessionId.slice(0, 8)}…</Badge>
        </div>
      </div>

      <Card className="border-emerald-200 bg-emerald-50/40">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <ScanBarcode className="h-5 w-5 text-emerald-600" />
            Barcode Scanner
          </CardTitle>
          <CardDescription>
            Plug in your scanner gun (USB wire or Bluetooth HID mode) and scan product barcodes.
            Each scan adds the item to this bill automatically.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row">
            <Input
              ref={scanInputRef}
              autoFocus
              value={scanValue}
              onChange={(e) => setScanValue(e.target.value)}
              placeholder="Scan barcode here or type manually, then Enter…"
              className="h-12 bg-white text-base font-mono"
              autoComplete="off"
              spellCheck={false}
            />
            <Button type="submit" className="h-12 shrink-0 gap-2">
              <ScanBarcode className="h-4 w-4" />
              Add Item
            </Button>
          </form>

          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Wifi className="h-3.5 w-3.5" />
              USB wired &amp; Bluetooth keyboard-mode scanners supported
            </span>
            {lastScan ? (
              <span className="font-medium text-emerald-700">
                Last scan: {lastScan.name} ({lastScan.barcode})
              </span>
            ) : (
              <span>Waiting for first scan…</span>
            )}
          </div>
        </CardContent>
      </Card>

      <AdminSessionItems sessionId={sessionId} status="active" />

      <div className="flex flex-wrap justify-end gap-3">
        <Button variant="outline" onClick={handleCancel} disabled={acting}>
          Cancel Bill
        </Button>
        <Button onClick={handleCheckout} disabled={acting}>
          Checkout
        </Button>
      </div>
    </div>
  )
}
