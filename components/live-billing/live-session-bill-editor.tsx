"use client"

import { useEffect, useState } from "react"
import { collection, onSnapshot } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { firestoreNumber, liveSessionItemQuantity } from "@/lib/stock"
import { clampDiscountPercent } from "@/lib/billing/line-discount"
import {
  LiveBillItemsEditor,
  type EditableLiveItem,
} from "@/components/live-billing/live-bill-items-editor"

export function LiveSessionBillEditor({
  sessionId,
  editable = true,
}: {
  sessionId: string
  editable?: boolean
}) {
  const [items, setItems] = useState<EditableLiveItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    const itemsCol = collection(db, "live_sessions", sessionId, "items")

    const unsubscribe = onSnapshot(
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
              discountPercent: clampDiscountPercent(firestoreNumber(data.discountPercent, 0)),
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

    return () => unsubscribe()
  }, [sessionId])

  return (
    <LiveBillItemsEditor
      sessionId={sessionId}
      items={items}
      loading={loading}
      editable={editable}
    />
  )
}
