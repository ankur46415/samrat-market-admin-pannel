"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import type { PaymentLedgerEntry, PaymentPayee } from "@/lib/features/payment-management/models"
import { payeePaymentsTotal, payeePurchasesTotal, payeeRemaining } from "@/lib/features/payment-management/models"
import {
  addPaymentLedgerEntry,
  addPaymentPayee,
  deletePaymentLedgerEntry,
  deletePaymentPayee,
  subscribePaymentLedger,
  subscribePaymentPayees,
  updatePaymentLedgerEntry,
  updatePaymentPayee,
} from "@/lib/features/payment-management/service"

export function usePaymentManagement() {
  const [payees, setPayees] = useState<PaymentPayee[]>([])
  const [entries, setEntries] = useState<PaymentLedgerEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let payeesReady = false
    let entriesReady = false
    const markReady = () => {
      if (payeesReady && entriesReady) setLoading(false)
    }

    const unsubPayees = subscribePaymentPayees(
      (data) => {
        setPayees(data)
        payeesReady = true
        markReady()
      },
      () => {
        payeesReady = true
        markReady()
      }
    )
    const unsubEntries = subscribePaymentLedger(
      (data) => {
        setEntries(data)
        entriesReady = true
        markReady()
      },
      () => {
        entriesReady = true
        markReady()
      }
    )
    return () => {
      unsubPayees()
      unsubEntries()
    }
  }, [])

  const summaries = useMemo(() => {
    return payees.map((payee) => {
      const rows = entries.filter((e) => e.payeeId === payee.id)
      return {
        payee,
        purchases: payeePurchasesTotal(rows),
        paid: payeePaymentsTotal(rows),
        remaining: payeeRemaining(rows),
        entryCount: rows.length,
      }
    })
  }, [entries, payees])

  const totals = useMemo(() => {
    return summaries.reduce(
      (acc, row) => ({
        purchases: acc.purchases + row.purchases,
        paid: acc.paid + row.paid,
        remaining: acc.remaining + row.remaining,
      }),
      { purchases: 0, paid: 0, remaining: 0 }
    )
  }, [summaries])

  const createPayee = useCallback(async (input: { name: string; phone?: string; notes?: string }) => {
    return addPaymentPayee(input)
  }, [])

  const editPayee = useCallback(async (id: string, input: { name: string; phone?: string; notes?: string }) => {
    await updatePaymentPayee(id, input)
  }, [])

  const removePayee = useCallback(async (id: string) => {
    await deletePaymentPayee(id)
  }, [])

  const addEntry = useCallback(
    async (input: { payeeId: string; type: "purchase" | "payment"; amount: number; date: Date; notes?: string }) => {
      return addPaymentLedgerEntry(input)
    },
    []
  )

  const editEntry = useCallback(
    async (id: string, input: { type: "purchase" | "payment"; amount: number; date: Date; notes?: string }) => {
      await updatePaymentLedgerEntry(id, input)
    },
    []
  )

  const removeEntry = useCallback(async (id: string) => {
    await deletePaymentLedgerEntry(id)
  }, [])

  return {
    payees,
    entries,
    summaries,
    totals,
    loading,
    createPayee,
    editPayee,
    removePayee,
    addEntry,
    editEntry,
    removeEntry,
  }
}
