"use client"

import type { LiveBillingSession } from "@/lib/features/live_billing_admin/services/live_billing_admin_service"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"

function formatDateTime(value?: Date) {
  if (!value) return "-"
  return new Intl.DateTimeFormat("en-IN", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value)
}

export function AdminActiveSessionsList({
  sessions,
  selectedSessionId,
  onSelectSession,
}: {
  sessions: LiveBillingSession[]
  selectedSessionId: string | null
  onSelectSession: (sessionId: string) => void
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Active Sessions</CardTitle>
        <CardDescription>{sessions.length} active session(s)</CardDescription>
      </CardHeader>
      <CardContent>
        {sessions.length === 0 ? (
          <p className="text-muted-foreground py-4 text-sm">No active sessions right now.</p>
        ) : (
          <div className="space-y-2">
            {sessions.map((s) => {
              const isSelected = selectedSessionId === s.sessionId
              return (
                <button
                  key={s.sessionId}
                  type="button"
                  onClick={() => onSelectSession(s.sessionId)}
                  className={cn(
                    "w-full rounded-lg border px-3 py-2 text-left transition-colors",
                    isSelected
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-muted/50"
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">Session: {s.sessionId}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatDateTime(s.createdAt)}
                      </p>
                      {s.cashierId ? (
                        <p className="text-xs text-muted-foreground mt-1">
                          Cashier: {s.cashierId}
                        </p>
                      ) : null}
                    </div>
                    <Badge variant="outline" className="shrink-0">
                      active
                    </Badge>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

