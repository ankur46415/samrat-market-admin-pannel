"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Loader2, Plus, ScanBarcode, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { useProducts } from "@/hooks/use-firestore"
import { normalizeScannedBarcode } from "@/lib/stock"
import {
  removeItemFromSession,
  scanItemIntoSession,
} from "@/lib/features/live_billing_admin/services/live_billing_admin_service"

export type EditableLiveItem = {
  itemDocId: string
  barcode: string
  name: string
  price: number
  quantity: number
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount)
}

export function LiveBillItemsEditor({
  sessionId,
  items,
  loading,
  editable = true,
}: {
  sessionId: string
  items: EditableLiveItem[]
  loading?: boolean
  editable?: boolean
}) {
  const { products } = useProducts()
  const scanInputRef = useRef<HTMLInputElement>(null)
  const scanningRef = useRef(false)
  const [scanValue, setScanValue] = useState("")
  const [adding, setAdding] = useState(false)
  const [removingId, setRemovingId] = useState<string | null>(null)

  const productCache = products.map((p) => ({
    id: p.id,
    name: p.name,
    price: p.price,
    barcode: p.barcode,
  }))

  const focusScanInput = useCallback(() => {
    setTimeout(() => scanInputRef.current?.focus(), 30)
  }, [])

  useEffect(() => {
    if (editable && !loading) focusScanInput()
  }, [editable, loading, focusScanInput])

  useEffect(() => {
    if (editable && !adding) focusScanInput()
  }, [items.length, editable, adding, focusScanInput])

  const handleAddProduct = async (rawBarcode: string) => {
    const barcode = normalizeScannedBarcode(rawBarcode)
    if (!barcode || !editable || scanningRef.current) return

    scanningRef.current = true
    setAdding(true)
    setScanValue("")

    try {
      const item = await scanItemIntoSession(sessionId, barcode, productCache)
      toast.success(`${item.name} — qty ${item.quantity}`)
    } catch (e) {
      console.error(e)
      const msg = e instanceof Error ? e.message : "Failed to add product"
      toast.error(msg)
    } finally {
      setAdding(false)
      scanningRef.current = false
      focusScanInput()
    }
  }

  const handleRemove = async (item: EditableLiveItem) => {
    if (!editable) return
    const ok = window.confirm(`Remove "${item.name}" from this bill?`)
    if (!ok) return

    setRemovingId(item.itemDocId)
    try {
      await removeItemFromSession(sessionId, item.itemDocId)
      toast.success(`${item.name} removed`)
    } catch (e) {
      console.error(e)
      toast.error("Failed to remove product")
    } finally {
      setRemovingId(null)
    }
  }

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead className="text-right">Qty</TableHead>
              <TableHead className="text-right">Price</TableHead>
              <TableHead className="text-right">Total</TableHead>
              {editable ? <TableHead className="w-12 text-right">Remove</TableHead> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={editable ? 5 : 4} className="h-20 text-center text-muted-foreground">
                  No items in this bill yet.
                </TableCell>
              </TableRow>
            ) : (
              items.map((it) => (
                <TableRow key={it.itemDocId}>
                  <TableCell className="font-medium">{it.name || it.barcode}</TableCell>
                  <TableCell className="text-right">{it.quantity}</TableCell>
                  <TableCell className="text-right">{formatCurrency(it.price)}</TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(it.quantity * it.price)}
                  </TableCell>
                  {editable ? (
                    <TableCell className="text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                        disabled={removingId === it.itemDocId}
                        onClick={() => void handleRemove(it)}
                        title="Remove from bill"
                      >
                        {removingId === it.itemDocId ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    </TableCell>
                  ) : null}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {editable ? (
        <div className="rounded-lg border border-dashed bg-muted/20 p-4 space-y-3">
          <p className="text-sm font-medium flex items-center gap-2">
            <ScanBarcode className="h-4 w-4" />
            Add New Product
            {adding ? (
              <span className="text-xs font-normal text-muted-foreground">Saving…</span>
            ) : null}
          </p>
          <form
            className="flex flex-col gap-2 sm:flex-row"
            onSubmit={(e) => {
              e.preventDefault()
              const value = scanInputRef.current?.value ?? scanValue
              void handleAddProduct(value)
            }}
          >
            <Input
              ref={scanInputRef}
              value={scanValue}
              onChange={(e) => setScanValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  void handleAddProduct(e.currentTarget.value)
                }
              }}
              placeholder="Scan next barcode or type manually, then Enter…"
              className="font-mono bg-background"
              autoComplete="off"
              spellCheck={false}
            />
            <Button type="submit" disabled={adding} className="shrink-0 gap-2">
              {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Add
            </Button>
          </form>
          <p className="text-xs text-muted-foreground">
            Keep scanning — same barcode increases qty, different barcode adds new line.
          </p>
        </div>
      ) : null}
    </div>
  )
}
