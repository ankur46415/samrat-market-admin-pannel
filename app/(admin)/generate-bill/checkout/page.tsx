"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { PosTerminal } from "@/components/live-billing/pos-terminal"
import { Button } from "@/components/ui/button"

export default function GenerateBillCheckoutPage() {
  const [sessionId, setSessionId] = useState("")

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    setSessionId(params.get("sessionId") || "")
  }, [])

  if (!sessionId) {
    return (
      <div className="space-y-4">
        <p className="text-muted-foreground">Session not selected.</p>
        <Button asChild>
          <Link href="/generate-bill">Back to Generate Bill</Link>
        </Button>
      </div>
    )
  }

  return <PosTerminal sessionId={sessionId} mode="checkout" />
}
