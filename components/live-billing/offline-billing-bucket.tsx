"use client"

import { useCallback, useEffect, useState } from "react"
import { CloudOff, Loader2, RefreshCw, Trash2, Wifi } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { deleteOfflineBill, listOfflineBills, type OfflineBill } from "@/lib/offline/offline-bills"
import { loadProductCache } from "@/lib/offline/product-cache"
import { syncAllOfflineBills, syncOneOfflineBill } from "@/lib/offline/sync-offline-bills"
import { useOnlineStatus } from "@/lib/offline/use-online-status"

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(amount)
}

export function OfflineBillingBucket() {
  const online = useOnlineStatus()
  const [bills, setBills] = useState<OfflineBill[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [cachedProductCount, setCachedProductCount] = useState<number | null>(null)

  const refresh = useCallback(async () => {
    const [rows, products] = await Promise.all([listOfflineBills(), loadProductCache()])
    setBills(rows)
    setCachedProductCount(products.length)
    setLoading(false)
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    if (!online) return
    let cancelled = false
    setSyncing(true)
    void syncAllOfflineBills()
      .then((result) => {
        if (cancelled) return
        if (result.synced > 0) {
          toast.success(
            result.failed
              ? `Synced ${result.synced} bill(s). ${result.failed} still pending.`
              : `Synced ${result.synced} offline bill(s)`
          )
        }
      })
      .catch(() => {
        /* keep pending */
      })
      .finally(() => {
        if (!cancelled) {
          setSyncing(false)
          void refresh()
        }
      })
    return () => {
      cancelled = true
    }
  }, [online, refresh])

  const handleSyncAll = async () => {
    if (!online) {
      toast.error("Connect to the internet to sync")
      return
    }
    setSyncing(true)
    try {
      const result = await syncAllOfflineBills()
      if (result.synced === 0 && result.failed === 0) toast.message("Nothing to sync")
      else if (result.failed) toast.warning(`Synced ${result.synced}. ${result.failed} failed.`)
      else toast.success(`Synced ${result.synced} bill(s)`)
      await refresh()
    } finally {
      setSyncing(false)
    }
  }

  const handleSyncOne = async (id: string) => {
    if (!online) {
      toast.error("Connect to the internet to sync")
      return
    }
    setSyncing(true)
    try {
      await syncOneOfflineBill(id)
      toast.success("Bill synced")
      await refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Sync failed")
      await refresh()
    } finally {
      setSyncing(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this offline bill? It will not be synced.")) return
    await deleteOfflineBill(id)
    await refresh()
  }

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <CloudOff className="h-4 w-4" />
            Offline Billing
            {bills.length > 0 ? <Badge variant="secondary">{bills.length}</Badge> : null}
          </CardTitle>
          <CardDescription>
            Bills saved when the network was down. They post to sales and stock when you are online.
            {cachedProductCount == null
              ? ""
              : ` ${cachedProductCount.toLocaleString("en-IN")} products saved on this computer for offline scan.`}
          </CardDescription>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {cachedProductCount != null ? (
            <Badge variant="outline">{cachedProductCount.toLocaleString("en-IN")} products cached</Badge>
          ) : null}
          <Badge variant={online ? "secondary" : "outline"} className="gap-1">
            {online ? <Wifi className="h-3.5 w-3.5" /> : <CloudOff className="h-3.5 w-3.5" />}
            {online ? "Online" : "Offline"}
          </Badge>
          <Button size="sm" onClick={() => void handleSyncAll()} disabled={!online || syncing || bills.length === 0}>
            {syncing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Sync now
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading offline bills…</p>
        ) : bills.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No pending offline bills. Product list is cached on this computer whenever you open billing or inventory
            online.
          </p>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Bill no</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[120px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {bills.map((bill) => (
                  <TableRow key={bill.id}>
                    <TableCell className="whitespace-nowrap text-sm">
                      {new Date(bill.createdAt).toLocaleString("en-IN")}
                    </TableCell>
                    <TableCell className="font-mono text-xs font-medium">{bill.billNo || "—"}</TableCell>
                    <TableCell>
                      <div className="text-sm font-medium">{bill.items.length} line(s)</div>
                      <div className="max-w-[240px] truncate text-xs text-muted-foreground">
                        {bill.items.map((i) => i.name).join(", ")}
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      {formatCurrency(bill.total)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={bill.status === "failed" ? "destructive" : "secondary"}>
                        {bill.status}
                      </Badge>
                      {bill.lastError ? (
                        <p className="mt-1 max-w-[180px] truncate text-xs text-destructive">{bill.lastError}</p>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end">
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled={!online || syncing}
                          onClick={() => void handleSyncOne(bill.id)}
                        >
                          <RefreshCw className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => void handleDelete(bill.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
