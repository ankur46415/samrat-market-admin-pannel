"use client"

import { useEffect, useMemo, useState } from "react"
import { format } from "date-fns"
import { Phone, Search, Send, Trash2, Copy, ExternalLink } from "lucide-react"
import { toast } from "sonner"
import { useCustomers, useSales } from "@/hooks/use-firestore"
import { useMessageCampaigns, useMessageTemplates } from "@/hooks/use-message-templates"
import { useSessionUser } from "@/lib/auth-session"
import type { MessageCampaignRecipient } from "@/lib/features/messaging/models"
import {
  deleteMessageTemplate,
  fillMessageTemplate,
  filterMessagingCustomers,
  openWhatsAppChat,
  recordMessageCampaign,
  saveMessageTemplate,
  readStoredWhatsAppQueue,
  smsHref,
  toMessagingRows,
  whatsappHref,
  whatsappWindowName,
  writeStoredWhatsAppQueue,
} from "@/lib/features/messaging/service"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount)
}

export function MessagingPage() {
  const { user } = useSessionUser()
  const { customers, loading: customersLoading } = useCustomers()
  const { sales, loading: salesLoading } = useSales()
  const { templates, loading: templatesLoading } = useMessageTemplates()
  const { campaigns } = useMessageCampaigns()

  const [tab, setTab] = useState("send")
  const [templateId, setTemplateId] = useState("")
  const [templateName, setTemplateName] = useState("")
  const [title, setTitle] = useState("")
  const [body, setBody] = useState("")
  const [search, setSearch] = useState("")
  const [minPurchasesText, setMinPurchasesText] = useState("")
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)
  const [sending, setSending] = useState(false)
  const [lastRecipients, setLastRecipients] = useState<MessageCampaignRecipient[]>([])
  const [whatsAppQueue, setWhatsAppQueue] = useState<MessageCampaignRecipient[]>([])
  const [whatsAppQueueTotal, setWhatsAppQueueTotal] = useState(0)

  useEffect(() => {
    const stored = readStoredWhatsAppQueue()
    if (!stored) return
    setWhatsAppQueue(stored.remaining)
    setWhatsAppQueueTotal(stored.total)
  }, [])

  const rows = useMemo(
    () => toMessagingRows(customers, sales),
    [customers, sales]
  )

  const minPurchases = useMemo(() => {
    const n = Number(minPurchasesText.replace(/,/g, "").trim())
    if (!Number.isFinite(n) || minPurchasesText.trim() === "") return null
    return n
  }, [minPurchasesText])

  const filtered = useMemo(
    () => filterMessagingCustomers(rows, search, minPurchases),
    [rows, search, minPurchases]
  )

  const sendable = useMemo(
    () => filtered.filter((row) => row.hasSendablePhone),
    [filtered]
  )

  const applyTemplate = (id: string) => {
    setTemplateId(id)
    const found = templates.find((t) => t.id === id)
    if (!found) return
    setTemplateName(found.name)
    setTitle(found.title)
    setBody(found.body)
  }

  const resetEditor = () => {
    setTemplateId("")
    setTemplateName("")
    setTitle("")
    setBody("")
  }

  const toggleId = (id: string, on: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (on) next.add(id)
      else next.delete(id)
      return next
    })
  }

  const selectAllFiltered = (on: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      for (const row of sendable) {
        if (on) next.add(row.id)
        else next.delete(row.id)
      }
      return next
    })
  }

  const selectedRows = useMemo(
    () => filtered.filter((row) => selectedIds.has(row.id) && row.hasSendablePhone),
    [filtered, selectedIds]
  )

  const allFilteredSelected =
    sendable.length > 0 && sendable.every((row) => selectedIds.has(row.id))

  const previewCustomer = selectedRows[0] || sendable[0] || filtered[0]

  const saveTemplate = async () => {
    setSaving(true)
    try {
      const id = await saveMessageTemplate({
        id: templateId || undefined,
        name: templateName,
        title,
        body,
      })
      setTemplateId(id)
      toast.success("Template saved")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save template")
    } finally {
      setSaving(false)
    }
  }

  const removeTemplate = async (id: string) => {
    try {
      await deleteMessageTemplate(id)
      if (templateId === id) resetEditor()
      toast.success("Template deleted")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete template")
    }
  }

  const buildRecipients = (audience: "selected" | "all_matching"): MessageCampaignRecipient[] => {
    const targets = audience === "selected" ? selectedRows : sendable
    return targets.map((row) => ({
      customerId: row.id,
      name: row.name,
      phone: row.phone,
      title: fillMessageTemplate(title, row),
      body: fillMessageTemplate(body, row),
      purchasedAmount: row.purchasedAmount,
    }))
  }

  const sendTo = async (audience: "selected" | "all_matching") => {
    if (!title.trim() || !body.trim()) {
      toast.error("Enter a title and message body, or pick a template")
      return
    }
    const recipients = buildRecipients(audience)
    if (recipients.length === 0) {
      toast.error(
        audience === "selected"
          ? "Select at least one customer with a phone number"
          : "No matching customers with a phone number"
      )
      return
    }
    if (audience === "selected") {
      openWhatsAppChat(recipients[0].phone, recipients[0].body)
      const remaining = recipients.slice(1)
      setWhatsAppQueueTotal(recipients.length)
      setWhatsAppQueue(remaining)
      writeStoredWhatsAppQueue(remaining, recipients.length)
      setLastRecipients(recipients)
      toast.success(
        recipients.length === 1
          ? `Opened WhatsApp for ${recipients[0].name}`
          : `Opened WhatsApp for ${recipients[0].name}. Click Open next for the other ${recipients.length - 1}.`
      )
    }
    setSending(true)
    try {
      await recordMessageCampaign({
        templateId: templateId || undefined,
        templateName: templateName.trim() || "Untitled",
        title: title.trim(),
        body: body.trim(),
        audience,
        minPurchases: minPurchases ?? undefined,
        search: search.trim() || undefined,
        createdBy: user?.email || user?.name || "admin",
        recipients,
      })
      if (audience !== "selected") {
        setLastRecipients(recipients)
        toast.success(`Saved send to ${recipients.length} customers. Phone numbers copied.`)
      }
      const phones = recipients.map((r) => r.phone).join(", ")
      try {
        await navigator.clipboard.writeText(phones)
      } catch {
        /* clipboard may be blocked */
      }
    } catch (error) {
      toast.error(
        error instanceof Error
          ? `Send log not saved (${error.message}). You can still open WhatsApp.`
          : "Send log not saved (offline). You can still open WhatsApp."
      )
    } finally {
      setSending(false)
    }
  }

  const advanceWhatsAppQueue = () => {
    setWhatsAppQueue((queue) => {
      const remaining = queue.slice(1)
      writeStoredWhatsAppQueue(remaining, whatsAppQueueTotal)
      return remaining
    })
  }

  const skipNextWhatsApp = () => {
    advanceWhatsAppQueue()
  }

  const stopWhatsAppQueue = () => {
    setWhatsAppQueue([])
    writeStoredWhatsAppQueue([], 0)
  }

  const copyPhones = async (list: MessageCampaignRecipient[]) => {
    try {
      await navigator.clipboard.writeText(list.map((r) => r.phone).join(", "))
      toast.success("Phone numbers copied")
    } catch {
      toast.error("Could not copy")
    }
  }

  const loading = customersLoading || salesLoading

  const nextQueued = whatsAppQueue[0]

  return (
    <div className={whatsAppQueue.length > 0 ? "space-y-6 pb-28" : "space-y-6"}>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Messaging</h1>
        <p className="text-muted-foreground">
          Create notification templates, pick customers from the list, and send to selected
          phones or everyone who matches your filters.
        </p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="send">Send</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="history">Sent</TabsTrigger>
        </TabsList>

        <TabsContent value="send" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Message</CardTitle>
              <CardDescription>
                Use a saved template or write one now. Placeholders:{" "}
                <span className="font-mono text-xs">
                  {"{{name}} {{phone}} {{purchases}} {{balance}}"}
                </span>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="msg-template">Template</Label>
                  <select
                    id="msg-template"
                    className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
                    value={templateId}
                    onChange={(e) => {
                      if (!e.target.value) {
                        resetEditor()
                        return
                      }
                      applyTemplate(e.target.value)
                    }}
                    disabled={templatesLoading}
                  >
                    <option value="">Custom / new template</option>
                    {templates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="msg-tname">Template name</Label>
                  <Input
                    id="msg-tname"
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                    placeholder="Festival offer"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="msg-title">Title</Label>
                <Input
                  id="msg-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Samrat Market"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="msg-body">Body</Label>
                <Textarea
                  id="msg-body"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={5}
                  placeholder="Hi {{name}}, thanks for shopping with us. Your purchases: {{purchases}}."
                />
              </div>
              {previewCustomer ? (
                <div className="rounded-md border bg-muted/40 p-3 text-sm">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Preview for {previewCustomer.name}
                  </p>
                  <p className="mt-1 font-medium">{fillMessageTemplate(title, previewCustomer)}</p>
                  <p className="whitespace-pre-wrap text-muted-foreground">
                    {fillMessageTemplate(body, previewCustomer)}
                  </p>
                </div>
              ) : null}
              <Button type="button" variant="outline" onClick={saveTemplate} disabled={saving}>
                Save as template
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Customers</CardTitle>
              <CardDescription>
                Search by name or phone. Optional filter: purchased amount more than a number
                you enter. {sendable.length} with a phone number
                {filtered.length !== rows.length ? ` (of ${filtered.length} matching)` : ""}.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search by name or phone..."
                    className="pl-8"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Label htmlFor="min-buy" className="shrink-0 text-sm">
                    Purchased more than
                  </Label>
                  <Input
                    id="min-buy"
                    type="number"
                    min={0}
                    value={minPurchasesText}
                    onChange={(e) => setMinPurchasesText(e.target.value)}
                    placeholder="Amount in ₹"
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="default"
                  disabled={sending || loading}
                  onClick={() => sendTo("selected")}
                >
                  <Send className="mr-2 h-4 w-4" />
                  Send to selected on WhatsApp ({selectedRows.length})
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={sending || loading}
                  onClick={() => sendTo("all_matching")}
                >
                  Send to all matching ({sendable.length})
                </Button>
              </div>

              {whatsAppQueue.length > 0 ? (
                <div className="flex flex-col gap-3 rounded-md border border-primary/40 bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-medium">
                      WhatsApp {whatsAppQueueTotal - whatsAppQueue.length} of {whatsAppQueueTotal} opened
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Next: {whatsAppQueue[0].name} · {whatsAppQueue[0].phone}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      WhatsApp only opens one chat per click. Keep clicking Open next for each person.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button asChild>
                      <a
                        href={whatsappHref(whatsAppQueue[0].phone, whatsAppQueue[0].body)}
                        target={whatsappWindowName(whatsAppQueue[0].phone)}
                        rel="noreferrer"
                        onClick={advanceWhatsAppQueue}
                      >
                        Open next: {whatsAppQueue[0].name} ({whatsAppQueue.length} left)
                      </a>
                    </Button>
                    <Button type="button" variant="ghost" onClick={skipNextWhatsApp}>
                      Skip
                    </Button>
                    <Button type="button" variant="ghost" onClick={stopWhatsAppQueue}>
                      Stop
                    </Button>
                  </div>
                </div>
              ) : null}

              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">
                        <Checkbox
                          checked={allFilteredSelected}
                          onCheckedChange={(v) => selectAllFiltered(v === true)}
                          aria-label="Select all matching"
                        />
                      </TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead className="text-right">Purchased</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-muted-foreground">
                          Loading customers…
                        </TableCell>
                      </TableRow>
                    ) : filtered.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-muted-foreground">
                          No customers match this search or purchase filter.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filtered.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell>
                            <Checkbox
                              checked={selectedIds.has(row.id)}
                              disabled={!row.hasSendablePhone}
                              onCheckedChange={(v) => toggleId(row.id, v === true)}
                              aria-label={`Select ${row.name}`}
                            />
                          </TableCell>
                          <TableCell className="font-medium">{row.name}</TableCell>
                          <TableCell>
                            {row.hasSendablePhone ? (
                              <span className="inline-flex items-center gap-1 font-mono text-sm">
                                <Phone className="h-3.5 w-3.5" />
                                {row.phone}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">No phone</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(row.purchasedAmount)}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {lastRecipients.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>Last send</CardTitle>
                <CardDescription>
                  {lastRecipients.length} recipients. Open SMS or WhatsApp per phone, or copy
                  the list.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => copyPhones(lastRecipients)}
                >
                  <Copy className="mr-2 h-4 w-4" />
                  Copy phones
                </Button>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Phone</TableHead>
                        <TableHead />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {lastRecipients.map((r) => (
                        <TableRow key={`${r.customerId}-${r.phone}`}>
                          <TableCell>{r.name}</TableCell>
                          <TableCell className="font-mono text-sm">{r.phone}</TableCell>
                          <TableCell className="text-right space-x-2">
                            <Button size="sm" variant="outline" asChild>
                              <a href={smsHref(r.phone, r.body)}>SMS</a>
                            </Button>
                            <Button size="sm" variant="outline" asChild>
                              <a
                                href={whatsappHref(r.phone, r.body)}
                                target={whatsappWindowName(r.phone)}
                                rel="noreferrer"
                              >
                                WhatsApp
                                <ExternalLink className="ml-1 h-3 w-3" />
                              </a>
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          ) : null}
        </TabsContent>

        <TabsContent value="templates">
          <Card>
            <CardHeader>
              <CardTitle>Saved templates</CardTitle>
              <CardDescription>
                Same idea as Firebase notification templates: a name, title, and body you can
                reuse.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {templates.length === 0 && !templatesLoading ? (
                <p className="text-sm text-muted-foreground">
                  No templates yet. Write a message on the Send tab and click Save as template.
                </p>
              ) : (
                <ul className="space-y-3">
                  {templates.map((t) => (
                    <li
                      key={t.id}
                      className="flex flex-col gap-2 rounded-md border p-3 sm:flex-row sm:items-start sm:justify-between"
                    >
                      <div>
                        <p className="font-medium">{t.name}</p>
                        <p className="text-sm">{t.title}</p>
                        <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                          {t.body}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            applyTemplate(t.id)
                            setTab("send")
                          }}
                        >
                          Use
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => removeTemplate(t.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle>Sent campaigns</CardTitle>
              <CardDescription>Logged in Firebase when you send.</CardDescription>
            </CardHeader>
            <CardContent>
              {campaigns.length === 0 ? (
                <p className="text-sm text-muted-foreground">No sends yet.</p>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>When</TableHead>
                        <TableHead>Template</TableHead>
                        <TableHead>Audience</TableHead>
                        <TableHead className="text-right">Recipients</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {campaigns.map((c) => (
                        <TableRow key={c.id}>
                          <TableCell>
                            {format(c.createdAt, "dd MMM yyyy, HH:mm")}
                          </TableCell>
                          <TableCell>
                            <div className="font-medium">{c.templateName}</div>
                            <div className="text-xs text-muted-foreground">{c.title}</div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">
                              {c.audience === "all_matching" ? "All matching" : "Selected"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">{c.recipientCount}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {nextQueued ? (
        <div className="fixed inset-x-0 bottom-0 z-50 border-t bg-background/95 p-3 shadow-lg backdrop-blur">
          <div className="mx-auto flex max-w-5xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm">
              <span className="font-medium">
                {whatsAppQueueTotal - whatsAppQueue.length} of {whatsAppQueueTotal} opened.
              </span>{" "}
              Next: {nextQueued.name} · {nextQueued.phone}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button asChild>
                <a
                  href={whatsappHref(nextQueued.phone, nextQueued.body)}
                  target={whatsappWindowName(nextQueued.phone)}
                  rel="noreferrer"
                  onClick={advanceWhatsAppQueue}
                >
                  Open next on WhatsApp ({whatsAppQueue.length} left)
                </a>
              </Button>
              <Button type="button" variant="outline" onClick={skipNextWhatsApp}>
                Skip
              </Button>
              <Button type="button" variant="ghost" onClick={stopWhatsAppQueue}>
                Stop
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
