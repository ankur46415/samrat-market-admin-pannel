"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { collection, onSnapshot, query, where } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { AdminActiveSessionsList } from "@/components/live-billing/admin-active-sessions-list"
import { AdminSessionItems } from "@/components/live-billing/admin-session-items"
import {
  cancelLiveBillingSession,
  type LiveBillingSession,
} from "@/lib/features/live_billing_admin/services/live_billing_admin_service"

function toDate(value: unknown): Date | undefined {
  if (!value) return undefined
  if (typeof value === "object" && value && "toDate" in value && typeof (value as any).toDate === "function") {
    return (value as any).toDate()
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
  const [selectedSessionMeta, setSelectedSessionMeta] = useState<LiveBillingSession | null>(null)
  const [selectedCancelled, setSelectedCancelled] = useState(false)
  const [acting, setActing] = useState(false)

  useEffect(() => {
    setLoading(true)
    const q = query(collection(db, "live_sessions"), where("status", "==", "active"))

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const nextSessions: LiveBillingSession[] = snapshot.docs.map((doc) => {
          const data = doc.data() as Record<string, unknown>
          return {
            sessionId: doc.id,
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

  // If selected session is no longer in active list, clear local active indicator.
  useEffect(() => {
    if (!selectedSessionId) return
    const stillActive = sessions.some((s) => s.sessionId === selectedSessionId)
    if (!stillActive && !selectedCancelled) {
      setSelectedSessionMeta((prev) => (prev ? { ...prev, status: "completed" } : prev))
    }
  }, [sessions, selectedCancelled, selectedSessionId])

  const selectedSessionExists = useMemo(() => {
    if (!selectedSessionId) return false
    return sessions.some((s) => s.sessionId === selectedSessionId)
  }, [sessions, selectedSessionId])

  const handleSelect = (sessionId: string) => {
    setSelectedSessionId(sessionId)
    setSelectedSessionMeta(sessions.find((s) => s.sessionId === sessionId) ?? null)
    setSelectedCancelled(false)
  }

  const handleCancel = async () => {
    if (!selectedSessionId || selectedCancelled) {
      setSelectedSessionId(null)
      setSelectedSessionMeta(null)
      setSelectedCancelled(false)
      return
    }

    const ok = window.confirm(
      "Cancel this bill? Live session status will be set to cancelled (it will disappear from Active Sessions)."
    )
    if (!ok) return

    try {
      setActing(true)
      await cancelLiveBillingSession(selectedSessionId)
      toast.success("Bill cancelled")
      setSelectedCancelled(true)
      setSelectedSessionMeta((prev) => (prev ? { ...prev, status: "cancelled" } : prev))
    } catch (e) {
      console.error(e)
      toast.error("Failed to cancel bill")
    } finally {
      setActing(false)
    }
  }

  const handleCheckout = () => {
    if (!selectedSessionId) return
    router.push(`/generate-bill/checkout?sessionId=${encodeURIComponent(selectedSessionId)}`)
  }

  return (
    <div className="space-y-8">
      {/* ── Header Section ── */}
      <div className="space-y-3 border-b border-border/40 pb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-primary via-primary to-accent bg-clip-text text-transparent">
              Generate Bill
            </h1>
            <p className="text-base text-muted-foreground mt-2">
              Complete the selected live billing session and checkout.
            </p>
          </div>

          {selectedSessionId && selectedCancelled ? (
            <Badge variant="destructive" className="w-fit h-fit">
              Cancelled
            </Badge>
          ) : null}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* ── Left Sidebar: Sessions ── */}
        <div className="lg:col-span-1">
          {loading ? (
            <Card className="border-border/50">
              <CardHeader className="pb-6">
                <CardTitle className="text-xl">Active Sessions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </CardContent>
            </Card>
          ) : (
            <AdminActiveSessionsList
              sessions={sessions}
              selectedSessionId={selectedSessionId}
              onSelectSession={handleSelect}
            />
          )}
        </div>

        {/* ── Main Content ── */}
        <div className="lg:col-span-2 space-y-6">
          {!selectedSessionId ? (
            <Card className="border-dashed border-2 border-border/50 hover:border-primary/30 transition-colors">
              <CardHeader className="pb-8">
                <CardTitle className="text-2xl">Select a Billing Session</CardTitle>
              </CardHeader>
              <CardContent className="pb-8">
                <div className="flex flex-col items-center gap-4 py-12">
                  <div className="rounded-full bg-primary/10 p-6">
                    <svg className="h-12 w-12 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                  </div>
                  <p className="text-center text-muted-foreground max-w-sm">
                    Select an active session from the left panel. Items will appear live as your phone app scans them.
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* ── Session Info Card ── */}
              <Card className="border-primary/30 bg-gradient-to-br from-card via-card to-primary/5 hover:border-primary/50 transition-colors">
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center justify-between gap-3 flex-wrap text-xl">
                    <span>Session Details</span>
                    <Badge variant={selectedCancelled ? "destructive" : selectedSessionExists ? "default" : "secondary"}>
                      {selectedCancelled ? "Cancelled" : selectedSessionExists ? "Active" : "Completed"}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-lg bg-muted/40 p-4 border border-border/40">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                      Session ID
                    </p>
                    <p className="text-lg font-mono font-bold text-foreground">{selectedSessionId}</p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-lg border border-border/60 bg-card p-3 hover:bg-muted/30 transition-colors">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        Status
                      </p>
                      <p className="text-sm font-bold text-foreground mt-2">
                        {selectedCancelled ? "Cancelled" : selectedSessionExists ? "Active" : "Completed"}
                      </p>
                    </div>
                    {selectedSessionMeta?.cashierId ? (
                      <div className="rounded-lg border border-border/60 bg-card p-3 hover:bg-muted/30 transition-colors">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                          Cashier
                        </p>
                        <p className="text-sm font-bold text-foreground mt-2">{selectedSessionMeta.cashierId}</p>
                      </div>
                    ) : null}
                    {selectedSessionMeta?.createdAt ? (
                      <div className="rounded-lg border border-border/60 bg-card p-3 hover:bg-muted/30 transition-colors">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                          Started
                        </p>
                        <p className="text-sm font-bold text-foreground mt-2">
                          {selectedSessionMeta.createdAt.toLocaleString("en-IN", { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                    ) : null}
                  </div>
                </CardContent>
              </Card>

              {/* ── Items Section ── */}
              <AdminSessionItems
                sessionId={selectedSessionId}
                status={selectedCancelled ? "cancelled" : selectedSessionExists ? "active" : "completed"}
              />

              {/* ── Action Buttons ── */}
              {!selectedCancelled && (
                <div className="flex gap-3 flex-wrap">
                  <Button
                    onClick={handleCheckout}
                    disabled={acting || !selectedSessionExists}
                    size="lg"
                    className="flex-1 min-w-[160px] h-11"
                  >
                    Proceed to Checkout
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleCancel}
                    disabled={acting}
                    size="lg"
                    className="h-11"
                  >
                    Cancel Bill
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

