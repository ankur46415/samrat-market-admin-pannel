"use client"

import { useCallback, useEffect, useState } from "react"
import { Loader2, Plus, Shield, Trash2, UserCog } from "lucide-react"
import { toast } from "sonner"
import { APP_PERMISSIONS, type AppPermissionId } from "@/lib/app-permissions"
import { useAdminAccountsApi } from "@/hooks/use-admin-accounts-api"
import type { ManagedAccountRecord } from "@/lib/managed-account-types"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

const STAFF_PERMISSION_OPTIONS = APP_PERMISSIONS.filter((p) =>
  ["scan-edit", "open-draft-entries", "draft-entries"].includes(p.id)
)

export function AccountManagementSettings() {
  const api = useAdminAccountsApi()
  const [accounts, setAccounts] = useState<ManagedAccountRecord[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [permissions, setPermissions] = useState<AppPermissionId[]>([
    "scan-edit",
    "open-draft-entries",
  ])
  const [saving, setSaving] = useState(false)

  const reload = useCallback(async () => {
    setLoadError(null)
    try {
      const rows = await api.listAccounts()
      setAccounts(rows)
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to load accounts"
      setLoadError(msg)
      setAccounts([])
    }
  }, [api])

  useEffect(() => {
    void reload()
  }, [reload])

  const togglePermission = (id: AppPermissionId, checked: boolean) => {
    setPermissions((prev) => {
      if (checked) return prev.includes(id) ? prev : [...prev, id]
      return prev.filter((p) => p !== id)
    })
  }

  const handleCreate = async () => {
    setSaving(true)
    try {
      await api.createAccount({ username, password, permissions })
      toast.success(`Account ${username.toUpperCase()} created`)
      setCreateOpen(false)
      setUsername("")
      setPassword("")
      setPermissions(["scan-edit", "open-draft-entries"])
      await reload()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Create failed")
    } finally {
      setSaving(false)
    }
  }

  const handleTogglePermission = async (account: ManagedAccountRecord, perm: AppPermissionId) => {
    if (account.role === "admin") return
    const next = account.permissions.includes(perm)
      ? account.permissions.filter((p) => p !== perm)
      : [...account.permissions, perm]
    if (next.length === 0) {
      toast.error("At least one permission is required")
      return
    }
    try {
      await api.updateAccount(account.uid, { permissions: next })
      toast.success("Permissions updated")
      await reload()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed")
    }
  }

  const handleDisable = async (account: ManagedAccountRecord) => {
    if (!confirm(`Disable account ${account.accountTag}? They will not be able to log in.`)) return
    try {
      await api.disableAccount(account.uid)
      toast.success("Account disabled")
      await reload()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Disable failed")
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-4 space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2">
            <UserCog className="h-5 w-5" />
            Account management
          </CardTitle>
          <CardDescription className="mt-1.5 max-w-2xl">
            Create staff logins with username and password. Choose which features they can open.
            Staff only see their own open draft queue; the main admin sees everyone&apos;s grouped by
            account.
          </CardDescription>
        </div>
        <Button type="button" className="gap-2" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" />
          Create account
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {loadError ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {loadError}
            {loadError.includes("FIREBASE_SERVICE_ACCOUNT") ? (
              <p className="mt-2 text-xs text-muted-foreground">
                Add env var <code className="font-mono">FIREBASE_SERVICE_ACCOUNT_JSON</code> on Vercel
                (full service account JSON, one line).
              </p>
            ) : null}
          </div>
        ) : null}

        {api.loading && accounts.length === 0 ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading accounts…
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Account</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Features</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {accounts.map((account) => (
                  <TableRow key={account.uid}>
                    <TableCell>
                      <div className="font-mono font-semibold">{account.accountTag || "—"}</div>
                      <div className="text-xs text-muted-foreground">{account.email}</div>
                    </TableCell>
                    <TableCell>
                      {account.role === "admin" ? (
                        <Badge className="gap-1">
                          <Shield className="h-3 w-3" />
                          Main admin
                        </Badge>
                      ) : account.disabled ? (
                        <Badge variant="destructive">Disabled</Badge>
                      ) : (
                        <Badge variant="secondary">Staff</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {account.role === "admin" ? (
                        <span className="text-sm text-muted-foreground">All features</span>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {STAFF_PERMISSION_OPTIONS.map((opt) => (
                            <label
                              key={opt.id}
                              className="inline-flex cursor-pointer items-center gap-1.5 text-xs"
                            >
                              <Checkbox
                                checked={account.permissions.includes(opt.id)}
                                disabled={account.disabled}
                                onCheckedChange={() =>
                                  void handleTogglePermission(account, opt.id)
                                }
                              />
                              {opt.label}
                            </label>
                          ))}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {account.role !== "admin" && !account.disabled ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="text-destructive"
                          onClick={() => void handleDisable(account)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create staff account</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="new-username">Username</Label>
              <Input
                id="new-username"
                placeholder="e.g. EMP03"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="off"
              />
              <p className="text-xs text-muted-foreground">
                Login with this username (stored as account tag, e.g. EMP03).
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-password">Password</Label>
              <Input
                id="new-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
              />
            </div>
            <div className="space-y-2">
              <Label>Allowed features</Label>
              <div className="grid gap-2">
                {STAFF_PERMISSION_OPTIONS.map((opt) => (
                  <label key={opt.id} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={permissions.includes(opt.id)}
                      onCheckedChange={(c) => togglePermission(opt.id, c === true)}
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button type="button" disabled={saving} onClick={() => void handleCreate()}>
              {saving ? "Creating…" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
