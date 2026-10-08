"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { KeyRound, Loader2, Plus } from "lucide-react"
import { toast } from "sonner"
import {
  createAccessCode,
  listAccessCodes,
  setAccessCodeActive,
  type AccessCode,
} from "@/lib/access-codes"
import { useAdminAccountsApi } from "@/hooks/use-admin-accounts-api"
import type { ManagedAccountRecord } from "@/lib/managed-account-types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

export function AccessCodesSettings() {
  const api = useAdminAccountsApi()
  const { listAccounts, updateAccount } = api
  const [accounts, setAccounts] = useState<ManagedAccountRecord[]>([])
  const [codes, setCodes] = useState<AccessCode[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [name, setName] = useState("")
  const [accountEmail, setAccountEmail] = useState("")
  const [saving, setSaving] = useState(false)

  const reload = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const [rows, list] = await Promise.all([listAccounts(), listAccessCodes()])
      setAccounts(rows)
      setCodes(list)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load access codes.")
    } finally {
      setLoading(false)
    }
  }, [listAccounts])

  useEffect(() => {
    void reload()
  }, [reload])

  const staff = useMemo(
    () => accounts.filter((account) => account.role !== "admin" && !account.disabled && account.email),
    [accounts]
  )

  useEffect(() => {
    if (accountEmail || staff.length === 0) return
    const shared = staff.find((account) => account.requiresAccessCode) ?? staff[0]
    setAccountEmail(shared.email)
  }, [staff, accountEmail])

  async function onToggleShared(account: ManagedAccountRecord, on: boolean) {
    try {
      await updateAccount(account.uid, { requiresAccessCode: on })
      toast.success(on ? `${account.email} now asks for an access code` : `${account.email} no longer asks for a code`)
      await reload()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed")
    }
  }

  async function onCreate() {
    setSaving(true)
    try {
      const created = await createAccessCode(name, accountEmail)
      toast.success(`Code ${created.code} created for ${created.name}`)
      setName("")
      await reload()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create the code.")
    } finally {
      setSaving(false)
    }
  }

  async function onToggleCode(code: AccessCode) {
    try {
      await setAccessCodeActive(code.code, !code.active)
      toast.success(code.active ? `Code for ${code.name} turned off` : `Code for ${code.name} turned on`)
      await reload()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed")
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeyRound className="h-5 w-5" />
          Access codes
        </CardTitle>
        <CardDescription className="max-w-2xl">
          Share one login with several people. After login they enter their own 6-digit code, and every edit is
          stamped with their name and code (for example ATUL-482913) so you can see who changed what.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <div className="space-y-2">
          <Label>Logins that ask for an access code</Label>
          {loading && staff.length === 0 ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </p>
          ) : (
            <div className="grid gap-2">
              {staff.map((account) => (
                <label key={account.uid} className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm">
                  <span>
                    <span className="font-medium">{account.email}</span>
                    {account.accountTag ? (
                      <span className="ml-2 font-mono text-xs text-muted-foreground">{account.accountTag}</span>
                    ) : null}
                  </span>
                  <Switch
                    checked={account.requiresAccessCode === true}
                    onCheckedChange={(on) => void onToggleShared(account, on)}
                  />
                </label>
              ))}
            </div>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <div className="space-y-1.5">
            <Label htmlFor="access-name">Person&apos;s name</Label>
            <Input id="access-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Atul" />
          </div>
          <div className="space-y-1.5">
            <Label>For login</Label>
            <Select value={accountEmail || undefined} onValueChange={setAccountEmail}>
              <SelectTrigger><SelectValue placeholder="Choose login" /></SelectTrigger>
              <SelectContent>
                {staff.map((account) => (
                  <SelectItem key={account.uid} value={account.email}>{account.email}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button type="button" onClick={() => void onCreate()} disabled={saving || !name.trim() || !accountEmail}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
            Create code
          </Button>
        </div>

        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Login</TableHead>
                <TableHead>Edits show as</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {codes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-6 text-center text-sm text-muted-foreground">
                    {loading ? "Loading…" : "No access codes yet."}
                  </TableCell>
                </TableRow>
              ) : (
                codes.map((code) => (
                  <TableRow key={code.code}>
                    <TableCell className="font-medium">{code.name}</TableCell>
                    <TableCell className="font-mono tracking-widest">{code.code}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{code.accountEmail}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {code.name.trim().toUpperCase().replace(/\s+/g, "_")}-{code.code}
                    </TableCell>
                    <TableCell>
                      <Badge variant={code.active ? "secondary" : "destructive"}>{code.active ? "Active" : "Off"}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button type="button" size="sm" variant="outline" onClick={() => void onToggleCode(code)}>
                        {code.active ? "Turn off" : "Turn on"}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}
