"use client"

import { useCallback, useEffect, useState } from "react"
import type { Customer } from "@/lib/types"
import {
  fetchCustomerById,
  fetchCustomerByPhone,
} from "@/lib/features/customers/services/customer_lookup_service"

const PHONE_LOOKUP_DEBOUNCE_MS = 350

/**
 * Lazy POS customer lookup — no full customers collection listener.
 * Phone search uses where("phone","==",phone) limit(1); id uses getDoc().
 */
export function usePosCustomerLookup(active: boolean) {
  const [customerPhone, setCustomerPhone] = useState("")
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null)
  const [phoneMatch, setPhoneMatch] = useState<Customer | null>(null)
  const [customerById, setCustomerById] = useState<Customer | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!active) return

    const phone = customerPhone.trim()
    if (!phone) {
      setPhoneMatch(null)
      return
    }

    let cancelled = false
    const timer = window.setTimeout(() => {
      void (async () => {
        setLoading(true)
        try {
          const found = await fetchCustomerByPhone(phone)
          if (!cancelled) setPhoneMatch(found)
        } catch (err) {
          console.error("Customer phone lookup error:", err)
          if (!cancelled) setPhoneMatch(null)
        } finally {
          if (!cancelled) setLoading(false)
        }
      })()
    }, PHONE_LOOKUP_DEBOUNCE_MS)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [active, customerPhone])

  useEffect(() => {
    if (!selectedCustomerId) {
      setCustomerById(null)
      return
    }
    if (phoneMatch?.id === selectedCustomerId) {
      setCustomerById(phoneMatch)
      return
    }

    let cancelled = false
    void (async () => {
      try {
        const found = await fetchCustomerById(selectedCustomerId)
        if (!cancelled) setCustomerById(found)
      } catch (err) {
        console.error("Customer id lookup error:", err)
        if (!cancelled) setCustomerById(null)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [phoneMatch, selectedCustomerId])

  useEffect(() => {
    if (phoneMatch) setSelectedCustomerId(phoneMatch.id)
  }, [phoneMatch])

  const matchedCustomer = phoneMatch
  const selectedCustomer =
    selectedCustomerId != null
      ? customerById?.id === selectedCustomerId
        ? customerById
        : phoneMatch?.id === selectedCustomerId
          ? phoneMatch
          : null
      : matchedCustomer

  const attachMatchedCustomer = useCallback(() => {
    if (phoneMatch) {
      setSelectedCustomerId(phoneMatch.id)
      return true
    }
    return false
  }, [phoneMatch])

  return {
    customerPhone,
    setCustomerPhone,
    selectedCustomerId,
    setSelectedCustomerId,
    matchedCustomer,
    selectedCustomer,
    loading,
    attachMatchedCustomer,
  }
}
