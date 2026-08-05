"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { collection, onSnapshot, query, where } from "firebase/firestore"
import { Monitor, Receipt, ScanBarcode } from "lucide-react"
import { db } from "@/lib/firebase"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AdminActiveSessionsList } from "@/components/live-billing/admin-active-sessions-list"
import {
  cancelLiveBillingSession,
  type LiveBillingSession,
} from "@/lib/features/live_billing_admin/services/live_billing_admin_service"

function toDate(value: unknown): Date | undefined {
  if (!value) return undefined
  if (
    typeof value === "object" &&
    value &&
    "toDate" in value &&
    typeof (value as { toDate: () => Date }).toDate === "function"
  ) {
    return (value as { toDate: () => Date }).toDate()
  }
  if (value instanceof Date) return value
  if (typeof value === "string") {
    const d = new Date(value)
    if (!Number.isNaN(d.getTime())) return d
  }
  return undefined
}

export default function GenerateBillPage() {
  const router = useRouter()
  const [sessions, setSessions] = useState<LiveBillingSession[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)
  const [acting, setActing] = useState(false)

  useEffect(() => {
    setLoading(true)
    const q = query(collection(db, "live_sessions"), where("status", "==", "active"))

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const nextSessions: LiveBillingSession[] = snapshot.docs.map((docSnap) => {
          const data = docSnap.data() as Record<string, unknown>
          return {
            sessionId: docSnap.id,
            createdAt: toDate(data.createdAt),
            status: String(data.status ?? "active"),
            cashierId: typeof data.cashierId === "string" ? data.cashierId : undefined,
          }
        })
        nextSessions.sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0))
        setSessions(nextSessions)
        setLoading(false)
      },
      (err) => {
        console.error("Live sessions error:", err)
        setSessions([])
        setLoading(false)
      }
    )

    return () => unsubscribe()
  }, [])

  const selectedSession = useMemo(
    () => sessions.find((s) => s.sessionId === selectedSessionId) ?? null,
    [sessions, selectedSessionId]
  )

  const handleCancel = async (sessionId: string) => {
    if (!window.confirm("Cancel this active bill?")) return
    try {
      setActing(true)
      await cancelLiveBillingSession(sessionId)
      toast.success("Bill cancelled")
      if (selectedSessionId === sessionId) setSelectedSessionId(null)
    } catch (e) {
      console.error(e)
      toast.error("Failed to cancel")
    } finally {
      setActing(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">Billing</p>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Generate Bill</h1>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            Supermarket POS billing — scan continuously, use keyboard shortcuts, complete bills quickly.
          </p>
        </div>
        <Button asChild size="lg" className="shrink-0 gap-2 font-semibold">
          <Link href="/generate-bill/scan">
            <ScanBarcode className="h-5 w-5" />
            Open POS Terminal
          </Link>
        </Button>
      </div>

      <Card className="overflow-hidden border-border/80 shadow-sm">
        <CardHeader className="border-b border-border/60 bg-muted/20 pb-4">
          <CardTitle className="text-base">Keyboard shortcuts</CardTitle>
          <CardDescription>Use these keys inside the POS terminal for faster billing</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2 pt-4">
          {["F2 Scan", "F10 Pay", "Esc Cancel", "Del Remove", "↑↓ Select"].map((key) => (
            <span key={key} className="rounded-md border border-border bg-muted/50 px-2.5 py-1 text-xs font-medium text-muted-foreground">
              {key}
            </span>
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-1">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <Monitor className="h-5 w-5 text-muted-foreground" />
              Active Sessions
            </h2>
            <Badge variant="secondary">{sessions.length} open</Badge>
          </div>

          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : (
            <AdminActiveSessionsList
              sessions={sessions}
              selectedSessionId={selectedSessionId}
              onSelectSession={setSelectedSessionId}
            />
          )}
        </div>

        <div className="lg:col-span-2">
          {!selectedSession ? (
            <Card className="flex min-h-[280px] flex-col items-center justify-center border-dashed p-8 text-center">
              <Receipt className="mb-4 h-12 w-12 text-muted-foreground/40" />
              <h3 className="text-lg font-semibold">No session selected</h3>
              <p className="mt-2 max-w-sm text-sm text-muted-foreground">
                Select an active session to resume in POS, or open a new terminal to start fresh billing.
              </p>
              <Button asChild className="mt-6 gap-2" variant="outline">
                <Link href="/generate-bill/scan">
                  <ScanBarcode className="h-4 w-4" />
                  New POS Session
                </Link>
              </Button>
            </Card>
          ) : (
            <Card className="border-border/80 shadow-sm">
              <CardHeader className="border-b border-border/60 bg-muted/20">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <CardDescription>Resume Session</CardDescription>
                    <CardTitle className="mt-1 font-mono text-sm">{selectedSession.sessionId}</CardTitle>
                    {selectedSession.cashierId ? (
                      <p className="mt-1 text-sm text-muted-foreground">Cashier: {selectedSession.cashierId}</p>
                    ) : null}
                    {selectedSession.createdAt ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Started {selectedSession.createdAt.toLocaleString("en-IN")}
                      </p>
                    ) : null}
                  </div>
                  <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">
                    Active
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 pt-6">
                <div className="flex flex-wrap gap-3">
                  <Button
                    className="gap-2 font-semibold"
                    onClick={() =>
                      router.push(`/generate-bill/scan?sessionId=${encodeURIComponent(selectedSession.sessionId)}`)
                    }
                  >
                    <ScanBarcode className="h-4 w-4" />
                    Resume in POS
                  </Button>
                  <Button variant="outline" disabled={acting} onClick={() => void handleCancel(selectedSession.sessionId)}>
                    Cancel Session
                  </Button>
                </div>
                <p className="border-t border-border/60 pt-4 text-xs text-muted-foreground">
                  Resume opens the full POS terminal with scan, edit, and payment.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
