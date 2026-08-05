"use client"

import { useEffect, useMemo, useState } from "react"
import { collection, doc, onSnapshot } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { firestoreNumber, liveSessionItemQuantity } from "@/lib/stock"
import type { EditableLiveItem } from "@/components/live-billing/live-bill-items-editor"

export function usePosSession(sessionId: string | null) {
  const [items, setItems] = useState<EditableLiveItem[]>([])
  const [loading, setLoading] = useState(true)
  const [sessionStatus, setSessionStatus] = useState<string>("active")

  useEffect(() => {
    if (!sessionId) {
      setItems([])
      setLoading(false)
      return
    }

    setLoading(true)

    const sessionRef = doc(db, "live_sessions", sessionId)
    const unsubSession = onSnapshot(
      sessionRef,
      (snap) => {
        if (!snap.exists()) {
          setSessionStatus("unknown")
          return
        }
        const data = snap.data() as Record<string, unknown>
        setSessionStatus(String(data.status ?? "active"))
      },
      () => setSessionStatus("unknown")
    )

    const itemsCol = collection(db, "live_sessions", sessionId, "items")
    const unsubItems = onSnapshot(
      itemsCol,
      (snapshot) => {
        const next = snapshot.docs
          .map((d) => {
            const data = d.data() as Record<string, unknown>
            return {
              itemDocId: d.id,
              barcode: String(data.barcode ?? d.id),
              name: String(data.name ?? "").trim(),
              price: firestoreNumber(data.price, 0),
              quantity: liveSessionItemQuantity(data),
            } satisfies EditableLiveItem
          })
          .sort((a, b) => a.name.localeCompare(b.name))
        setItems(next)
        setLoading(false)
      },
      () => {
        setItems([])
        setLoading(false)
      }
    )

    return () => {
      unsubSession()
      unsubItems()
    }
  }, [sessionId])

  const totals = useMemo(() => {
    const lines = items.length
    const qty = items.reduce((sum, i) => sum + i.quantity, 0)
    const total = items.reduce((sum, i) => sum + i.quantity * i.price, 0)
    return { lines, qty, total }
  }, [items])

  return { items, loading, sessionStatus, totals }
}
