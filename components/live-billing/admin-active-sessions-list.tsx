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
    <Card className="border-border/50 overflow-hidden">
      <CardHeader className="pb-6 bg-gradient-to-r from-primary/5 via-transparent to-transparent border-b border-border/40">
        <CardTitle className="text-xl">Active Sessions</CardTitle>
        <CardDescription className="text-sm">
          {sessions.length} active session{sessions.length !== 1 ? "s" : ""}
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        {sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-12 px-4 text-center">
            <div className="rounded-full bg-muted p-3">
              <svg className="h-6 w-6 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-sm text-muted-foreground">No active sessions</p>
          </div>
        ) : (
          <div className="divide-y divide-border/40">
            {sessions.map((s) => {
              const isSelected = selectedSessionId === s.sessionId
              return (
                <button
                  key={s.sessionId}
                  type="button"
                  onClick={() => onSelectSession(s.sessionId)}
                  className={cn(
                    "w-full px-4 py-3 text-left transition-all hover:bg-muted/50",
                    isSelected && "bg-primary/10 border-l-4 border-primary"
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm font-bold text-foreground truncate">
                          {s.sessionId.slice(0, 8)}...
                        </p>
                        <Badge 
                          variant={isSelected ? "default" : "secondary"}
                          className="shrink-0 text-xs"
                        >
                          active
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground/80">
                        {formatDateTime(s.createdAt)}
                      </p>
                      {s.cashierId ? (
                        <p className="text-xs text-muted-foreground/80 mt-1">
                          👤 {s.cashierId}
                        </p>
                      ) : null}
                    </div>
                    {isSelected && (
                      <div className="flex-shrink-0 h-2 w-2 rounded-full bg-primary mt-1" />
                    )}
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

