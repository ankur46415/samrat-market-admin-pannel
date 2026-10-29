export interface MessageTemplate {
  id: string
  name: string
  title: string
  body: string
  createdAt: Date
  updatedAt: Date
}

export interface MessageCampaignRecipient {
  customerId: string
  name: string
  phone: string
  title: string
  body: string
  purchasedAmount: number
}

export interface MessageCampaign {
  id: string
  templateId?: string
  templateName: string
  title: string
  body: string
  audience: "selected" | "all_matching"
  recipientCount: number
  minPurchases?: number
  search?: string
  createdAt: Date
  createdBy: string
}

export type MessagingCustomerRow = {
  id: string
  name: string
  phone: string
  purchasedAmount: number
  balance: number
  hasSendablePhone: boolean
}
