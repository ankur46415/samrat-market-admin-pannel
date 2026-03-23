"use client"

import { useEffect, useMemo, useState } from "react"
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
  completeLiveBillingSession,
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
  const [sessions, setSessions] = useState<LiveBillingSession[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)
  const [selectedSessionMeta, setSelectedSessionMeta] = useState<LiveBillingSession | null>(null)
  const [selectedCompleted, setSelectedCompleted] = useState(false)
  const [selectedCancelled, setSelectedCancelled] = useState(false)
  const [completing, setCompleting] = useState(false)

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

  // If selected session gets completed elsewhere, mark it completed in UI.
  useEffect(() => {
    if (!selectedSessionId) return
    const stillActive = sessions.some((s) => s.sessionId === selectedSessionId)
    if (!stillActive) {
      if (selectedCancelled) return
      if (!selectedCompleted) setSelectedCompleted(true)
    }
  }, [sessions, selectedCompleted, selectedCancelled, selectedSessionId])

  const selectedSessionExists = useMemo(() => {
    if (!selectedSessionId) return false
    return sessions.some((s) => s.sessionId === selectedSessionId)
  }, [sessions, selectedSessionId])

  const handleSelect = (sessionId: string) => {
    setSelectedSessionId(sessionId)
    setSelectedSessionMeta(sessions.find((s) => s.sessionId === sessionId) ?? null)
    setSelectedCompleted(false)
    setSelectedCancelled(false)
  }

  const handleCancel = async () => {
    if (!selectedSessionId || selectedCompleted || selectedCancelled) {
      setSelectedSessionId(null)
      setSelectedSessionMeta(null)
      setSelectedCompleted(false)
      setSelectedCancelled(false)
      return
    }

    const ok = window.confirm(
      "Cancel this bill? Live session status will be set to cancelled (it will disappear from Active Sessions)."
    )
    if (!ok) return

    try {
      setCompleting(true)
      await cancelLiveBillingSession(selectedSessionId)
      toast.success("Bill cancelled")
      setSelectedCancelled(true)
      setSelectedCompleted(false)
    } catch (e) {
      console.error(e)
      toast.error("Failed to cancel bill")
    } finally {
      setCompleting(false)
    }
  }

  const handleComplete = async () => {
    if (!selectedSessionId) return
    if (selectedCompleted) return

    try {
      setCompleting(true)
      await completeLiveBillingSession(selectedSessionId)
      toast.success("Bill generated successfully")
      setSelectedCompleted(true)
    } catch (e) {
      console.error(e)
      toast.error("Failed to generate bill")
    } finally {
      setCompleting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Generate Bill</h1>
          <p className="text-muted-foreground">Complete the selected live billing session.</p>
        </div>

        {selectedSessionId && selectedCompleted ? <Badge variant="outline">Completed</Badge> : null}
        {selectedSessionId && selectedCancelled ? <Badge variant="destructive">Cancelled</Badge> : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1">
          {loading ? (
            <Card>
              <CardHeader>
                <CardTitle>Active Sessions</CardTitle>
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

        <div className="lg:col-span-2 space-y-4">
          {!selectedSessionId ? (
            <Card>
              <CardHeader>
                <CardTitle>Pick a session</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Select an active session from the left. Items will appear live as phone scanning
                  continues.
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="rounded-lg border p-4 flex items-start justify-between gap-4 flex-wrap">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Selected Session</p>
                  <p className="text-sm font-semibold">{selectedSessionId}</p>
                  <div className="flex flex-wrap gap-x-3 gap-y-1">
                    <span className="text-xs text-muted-foreground">
                      Status:{" "}
                      <span className="font-medium text-foreground">
                        {selectedCancelled ? "cancelled" : selectedCompleted ? "completed" : "active"}
                      </span>
                    </span>
                    {selectedSessionMeta?.cashierId ? (
                      <span className="text-xs text-muted-foreground">
                        Cashier:{" "}
                        <span className="font-medium text-foreground">
                          {selectedSessionMeta.cashierId}
                        </span>
                      </span>
                    ) : null}
                    {selectedSessionMeta?.createdAt ? (
                      <span className="text-xs text-muted-foreground">
                        Started:{" "}
                        <span className="font-medium text-foreground">
                          {selectedSessionMeta.createdAt.toLocaleString("en-IN")}
                        </span>
                      </span>
                    ) : null}
                  </div>
                </div>

                <div className="flex gap-3 items-center">
                  {!selectedCompleted && !selectedCancelled ? (
                    <>
                      <Button variant="outline" onClick={handleCancel} disabled={completing}>
                        Cancel Bill
                      </Button>
                      <Button onClick={handleComplete} disabled={completing}>
                        {completing ? "Generating..." : "Generate Bill"}
                      </Button>
                    </>
                  ) : (
                    <Button variant="outline" onClick={handleCancel}>
                      Close
                    </Button>
                  )}
                </div>
              </div>

              <AdminSessionItems
                sessionId={selectedSessionId}
                status={selectedCancelled ? "cancelled" : selectedCompleted ? "completed" : "active"}
              />
            </>
          )}
        </div>
      </div>
    </div>
  )
}

