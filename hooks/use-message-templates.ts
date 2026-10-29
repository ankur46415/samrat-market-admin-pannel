"use client"

import { useEffect, useState } from "react"
import { useAccountModeScope } from "@/components/account-mode-provider"
import type { MessageCampaign, MessageTemplate } from "@/lib/features/messaging/models"
import {
  subscribeMessageCampaigns,
  subscribeMessageTemplates,
} from "@/lib/features/messaging/service"

export function useMessageTemplates() {
  const accountMode = useAccountModeScope()
  const [templates, setTemplates] = useState<MessageTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setTemplates([])
    setLoading(true)
    const unsub = subscribeMessageTemplates(
      (items) => {
        setTemplates(items)
        setLoading(false)
      },
      (message) => {
        setError(message)
        setLoading(false)
      }
    )
    return () => unsub()
  }, [accountMode])

  return { templates, loading, error }
}

export function useMessageCampaigns() {
  const accountMode = useAccountModeScope()
  const [campaigns, setCampaigns] = useState<MessageCampaign[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setCampaigns([])
    setLoading(true)
    const unsub = subscribeMessageCampaigns(
      (items) => {
        setCampaigns(items)
        setLoading(false)
      },
      () => setLoading(false)
    )
    return () => unsub()
  }, [accountMode])

  return { campaigns, loading }
}
