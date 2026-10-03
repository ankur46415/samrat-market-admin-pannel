"use client"

import { Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { Loader2 } from "lucide-react"
import { PosTerminal } from "@/components/live-billing/pos-terminal"

function ScanGenerateBillInner() {
  const searchParams = useSearchParams()
  const sessionId = searchParams.get("sessionId")

  return <PosTerminal sessionId={sessionId} mode="scan" />
}

export function ScanGenerateBill() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[60vh] items-center justify-center">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
        </div>
      }
    >
      <ScanGenerateBillInner />
    </Suspense>
  )
}
