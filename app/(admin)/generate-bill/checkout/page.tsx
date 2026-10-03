"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { PosTerminal } from "@/components/live-billing/pos-terminal"
import { Button } from "@/components/ui/button"

type CheckoutQuery = {
  sessionId: string
  customerPhone: string
  customerName: string
  customerId: string
}

export default function GenerateBillCheckoutPage() {
  const [query, setQuery] = useState<CheckoutQuery | null>(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    setQuery({
      sessionId: params.get("sessionId") || "",
      customerPhone: params.get("customerPhone") || "",
      customerName: params.get("customerName") || "",
      customerId: params.get("customerId") || "",
    })
  }, [])

  if (!query) {
    return <p className="text-muted-foreground">Loading checkout…</p>
  }

  if (!query.sessionId) {
    return (
      <div className="space-y-4">
        <p className="text-muted-foreground">Session not selected.</p>
        <Button asChild>
          <Link href="/generate-bill">Back to Generate Bill</Link>
        </Button>
      </div>
    )
  }

  return (
    <PosTerminal
      sessionId={query.sessionId}
      mode="checkout"
      initialCustomerPhone={query.customerPhone}
      initialCustomerName={query.customerName}
      initialCustomerId={query.customerId}
    />
  )
}
