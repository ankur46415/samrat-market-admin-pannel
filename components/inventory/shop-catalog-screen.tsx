"use client"

import { FormEvent, useEffect, useMemo, useState, type ReactNode } from "react"
import { toast } from "sonner"
import { Check, Loader2, Pencil, Plus, Trash2, X } from "lucide-react"
import { getAccountMode, subscribeAccountMode } from "@/lib/account-mode"
import { isRestrictedStaff, useSessionUser } from "@/lib/auth-session"
import { DEPARTMENTS, parseImport, slugifyId } from "@/lib/features/shop-catalog/parse"
import {
  deleteShopCatalogItem,
  loadShopCatalog,
  saveShopCatalog,
  setShopCatalogStatus,
  type AuditedCatalogItem,
  type CatalogActor,
} from "@/lib/features/shop-catalog/service"
import { inventoryTableFrameClassName, invTableCellClass, invTableHeadClass } from "@/lib/inventory-ui"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"

const PAGE_SIZE = 8

const emptyForm = {
  id: "",
  name: "",
  brand: "NA",
  category: "",
  department: "grocery",
  group_name: "",
  unit: "1 pc",
  price: "",
  image: "",
  tag: "",
  in_stock: true,
  is_active: true,
  group_qty: "0",
  sort_order: "0",
  group_id: "",
}

type CatalogItem = AuditedCatalogItem

function when(value: string | null) {
  if (!value) return ""
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date)
}

function statusOf(status: string | null | undefined) {
  return String(status ?? "").trim().toLowerCase()
}

function isDraft(item: CatalogItem) {
  return statusOf(item.status) === "draft"
}

function isLive(item: CatalogItem) {
  const status = statusOf(item.status)
  return status === "" || status === "live"
}

function money(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(value)
}

function uniqueNames(values: string[]) {
  const seen = new Map<string, string>()
  for (const raw of values) {
    const name = raw.trim()
    if (!name) continue
    const key = name.toLowerCase()
    if (!seen.has(key)) seen.set(key, name)
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b))
}

export function ShopCatalogScreen({ draftList }: { draftList: boolean }) {
  const { user } = useSessionUser()
  const staff = user ? isRestrictedStaff(user) : false
  const isAdmin = user?.role === "admin"
  const actor: CatalogActor = {
    tag: (user?.accountTag || (isAdmin ? "ADMIN" : user?.name) || "UNKNOWN").toUpperCase(),
    email: user?.email || "",
  }
  const [mode, setMode] = useState<"test" | "production">("test")
  const [items, setItems] = useState<CatalogItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [query, setQuery] = useState("")
  const [pageIndex, setPageIndex] = useState(0)
  const [filterField, setFilterField] = useState("")
  const [filterOp, setFilterOp] = useState("=")
  const [filterValue, setFilterValue] = useState("")
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [pending, setPending] = useState<{ item: CatalogItem; action: "approve" | "reject" | "delete" } | null>(null)
  const [busy, setBusy] = useState(false)
  const [importText, setImportText] = useState("")
  const [importing, setImporting] = useState(false)

  async function refresh() {
    setLoading(true)
    setError("")
    try {
      setItems(await loadShopCatalog())
    } catch (err) {
      setItems([])
      setError(err instanceof Error ? err.message : "Could not load the catalog.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setMode(getAccountMode())
    return subscribeAccountMode(() => setMode(getAccountMode()))
  }, [])

  useEffect(() => {
    void refresh()
  }, [mode])

  const scoped = useMemo(
    () =>
      items.filter((item) => {
        if (!(draftList ? isDraft(item) : isLive(item))) return false
        if (staff && (item.created_by || "").toUpperCase() !== actor.tag) return false
        return true
      }),
    [items, draftList, staff, actor.tag],
  )

  const brands = uniqueNames(items.map((item) => item.brand || "NA"))
  const categories = uniqueNames(items.map((item) => item.category))
  const groups = uniqueNames(items.map((item) => item.group_name))

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    const value = filterValue.trim()
    return scoped.filter((item) => {
      if (q) {
        const haystack = [item.name, item.brand, item.id, item.category, item.group_name, item.department]
          .join(" ")
          .toLowerCase()
        if (!haystack.includes(q)) return false
      }
      if (!filterField || !value) return true
      if (filterField === "brand") return (item.brand || "NA").trim().toLowerCase() === value.toLowerCase()
      if (filterField === "category") return item.category.trim().toLowerCase() === value.toLowerCase()
      if (filterField === "group") return item.group_name.trim().toLowerCase() === value.toLowerCase()
      if (filterField === "shop") return value === "active" ? item.is_active : !item.is_active
      const actual = filterField === "price" ? Number(item.price) : Number(item.group_qty)
      const expected = Number(value)
      if (!Number.isFinite(expected)) return true
      if (filterOp === ">") return actual > expected
      if (filterOp === "<") return actual < expected
      return Math.round(actual * 100) === Math.round(expected * 100)
    })
  }, [scoped, query, filterField, filterOp, filterValue])

  const pageCount = Math.max(1, Math.ceil(visible.length / PAGE_SIZE))
  const currentPage = Math.min(pageIndex, pageCount - 1)
  const pageRows = visible.slice(currentPage * PAGE_SIZE, currentPage * PAGE_SIZE + PAGE_SIZE)

  useEffect(() => {
    setPageIndex(0)
  }, [query, filterField, filterOp, filterValue, draftList, mode])

  function openNew() {
    setEditingId(null)
    setForm(emptyForm)
    setFormOpen(true)
  }

  function openEdit(item: CatalogItem) {
    setEditingId(item.id)
    setForm({
      id: item.id,
      name: item.name,
      brand: item.brand || "NA",
      category: item.category,
      department: item.department || "grocery",
      group_name: item.group_name,
      unit: item.unit,
      price: String(item.price),
      image: item.image,
      tag: item.tag || "",
      in_stock: item.in_stock,
      is_active: item.is_active,
      group_qty: String(item.group_qty),
      sort_order: String(item.sort_order),
      group_id: item.group_id || "",
    })
    setFormOpen(true)
  }

  async function onSave(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    const parsed = parseImport(JSON.stringify(form))
    if (parsed.errors.length || parsed.items.length !== 1) {
      setSaving(false)
      toast.error(parsed.errors[0]?.message || "Check the form and try again.")
      return
    }
    try {
      await saveShopCatalog(parsed.items, actor, staff)
      const updated = Boolean(editingId)
      setFormOpen(false)
      setEditingId(null)
      toast.success(
        updated
          ? `Updated ${parsed.items[0].name}.`
          : `Saved ${parsed.items[0].name} as a draft. It is in Draft Catalog until you approve it.`,
      )
      await refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save this item.")
    } finally {
      setSaving(false)
    }
  }

  async function confirmPending() {
    if (!pending) return
    setBusy(true)
    try {
      if (pending.action === "delete") {
        await deleteShopCatalogItem(pending.item.id)
        toast.success(`Deleted ${pending.item.name}.`)
      } else {
        const next = pending.action === "approve" ? "live" : "rejected"
        await setShopCatalogStatus(pending.item.id, next, actor)
        toast.success(
          pending.action === "approve"
            ? `${pending.item.name} is live on Catalog Items.`
            : `${pending.item.name} was rejected and will not show on Catalog Items.`,
        )
      }
      setPending(null)
      await refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update this item.")
      setPending(null)
    } finally {
      setBusy(false)
    }
  }

  async function onImport() {
    const parsed = parseImport(importText)
    if (parsed.errors.length) {
      toast.error(parsed.errors[0]?.message || "Fix the import before saving.")
      return
    }
    if (parsed.items.length === 0) return
    setImporting(true)
    try {
      const saved = await saveShopCatalog(parsed.items, actor, staff)
      setImportText("")
      toast.success(
        `Saved ${saved} catalog item${saved === 1 ? "" : "s"}. New items are drafts until you approve them. Matching ids kept their status.`,
      )
      await refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import failed.")
    } finally {
      setImporting(false)
    }
  }

  const filterChoices =
    filterField === "brand" ? uniqueNames(["NA", ...brands]) : filterField === "category" ? categories : groups

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{draftList ? "Draft Catalog" : "Catalog Items"}</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            {draftList
              ? staff
                ? `Items you add are saved as drafts under ${actor.tag}. An admin reviews and approves them.`
                : "New catalog items wait here with the account that created or edited them. Approve one to show it on Catalog Items. Reject keeps it off that list."
              : "Live items from the main admin Pre Live catalog. A new item is saved as a draft until you approve it in Draft Catalog. Test and Live follow the account switcher."}
          </p>
        </div>
        <Button onClick={openNew}>
          <Plus className="mr-2 h-4 w-4" />
          Add New Item
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label={draftList ? "Draft items" : "Catalog Items"} value={loading ? "…" : String(scoped.length)} />
        <Stat label="Marked active" value={loading ? "…" : String(scoped.filter((item) => item.is_active).length)} />
        <Stat label="Out of stock" value={loading ? "…" : String(scoped.filter((item) => item.group_qty === 0).length)} />
        <Stat label="Shown" value={loading ? "…" : String(visible.length)} />
      </div>

      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="flex flex-wrap gap-2">
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search name, id, category"
              className="max-w-sm"
            />
            <Select
              value={filterField || "all"}
              onValueChange={(value) => {
                setFilterField(value === "all" ? "" : value)
                setFilterOp("=")
                setFilterValue("")
              }}
            >
              <SelectTrigger className="w-[160px]"><SelectValue placeholder="Filter" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All products</SelectItem>
                <SelectItem value="brand">Brand</SelectItem>
                <SelectItem value="category">Category</SelectItem>
                <SelectItem value="group">Group</SelectItem>
                <SelectItem value="price">Price</SelectItem>
                <SelectItem value="qty">Quantity</SelectItem>
                <SelectItem value="shop">Shop</SelectItem>
              </SelectContent>
            </Select>
            {filterField === "price" || filterField === "qty" ? (
              <Select value={filterOp} onValueChange={setFilterOp}>
                <SelectTrigger className="w-[90px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="=">=</SelectItem>
                  <SelectItem value=">">&gt;</SelectItem>
                  <SelectItem value="<">&lt;</SelectItem>
                </SelectContent>
              </Select>
            ) : null}
            {filterField === "brand" || filterField === "category" || filterField === "group" ? (
              <Select value={filterValue || "any"} onValueChange={(value) => setFilterValue(value === "any" ? "" : value)}>
                <SelectTrigger className="w-[180px]"><SelectValue placeholder="Any" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any</SelectItem>
                  {filterChoices.map((name) => (
                    <SelectItem key={name} value={name}>{name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}
            {filterField === "price" || filterField === "qty" ? (
              <Input
                type="number"
                value={filterValue}
                onChange={(event) => setFilterValue(event.target.value)}
                placeholder={filterField === "price" ? "Price" : "Quantity"}
                className="w-[140px]"
              />
            ) : null}
            {filterField === "shop" ? (
              <Select value={filterValue || "any"} onValueChange={(value) => setFilterValue(value === "any" ? "" : value)}>
                <SelectTrigger className="w-[140px]"><SelectValue placeholder="Any" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="hidden">Hidden</SelectItem>
                </SelectContent>
              </Select>
            ) : null}
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <div className={inventoryTableFrameClassName()}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className={invTableHeadClass}>Name</TableHead>
                  <TableHead className={invTableHeadClass}>ID</TableHead>
                  <TableHead className={invTableHeadClass}>Brand</TableHead>
                  <TableHead className={invTableHeadClass}>Category</TableHead>
                  <TableHead className={invTableHeadClass}>Group</TableHead>
                  <TableHead className={invTableHeadClass}>Price</TableHead>
                  <TableHead className={invTableHeadClass}>Qty</TableHead>
                  <TableHead className={invTableHeadClass}>Status</TableHead>
                  <TableHead className={invTableHeadClass}>Created by</TableHead>
                  <TableHead className={invTableHeadClass}>Edited by</TableHead>
                  <TableHead className={invTableHeadClass} />
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={11} className="py-8 text-center text-sm text-muted-foreground">
                      {loading
                        ? "Loading catalog…"
                        : query.trim() || (filterField && filterValue.trim())
                          ? "No products match this filter."
                          : draftList
                            ? "No draft items. New catalog items appear here until they are approved."
                            : "No live catalog items yet."}
                    </TableCell>
                  </TableRow>
                ) : pageRows.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className={invTableCellClass}>
                      <div className="flex items-center gap-2">
                        {item.image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={item.image} alt="" className="h-9 w-9 rounded object-cover" />
                        ) : (
                          <span className="h-9 w-9 rounded bg-muted" />
                        )}
                        <span className="font-medium">{item.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className={invTableCellClass}>{item.id}</TableCell>
                    <TableCell className={invTableCellClass}>{item.brand || "NA"}</TableCell>
                    <TableCell className={invTableCellClass}>{item.category}</TableCell>
                    <TableCell className={invTableCellClass}>{item.group_name}</TableCell>
                    <TableCell className={invTableCellClass}>{money(item.price)}</TableCell>
                    <TableCell className={invTableCellClass}>{item.group_qty}</TableCell>
                    <TableCell className={invTableCellClass}>
                      <Badge variant={item.is_active ? "default" : "secondary"}>
                        {item.is_active ? "Active" : "Hidden"}
                      </Badge>
                    </TableCell>
                    <TableCell className={invTableCellClass}>
                      <div className="font-mono text-xs font-semibold">{item.created_by || "—"}</div>
                      <div className="text-xs text-muted-foreground">{when(item.created_at)}</div>
                    </TableCell>
                    <TableCell className={invTableCellClass}>
                      <div className="font-mono text-xs font-semibold">{item.updated_by || "—"}</div>
                      <div className="text-xs text-muted-foreground">{when(item.updated_at)}</div>
                      {!draftList && item.reviewed_by ? (
                        <div className="text-xs text-muted-foreground">Approved by {item.reviewed_by}</div>
                      ) : null}
                    </TableCell>
                    <TableCell className={invTableCellClass}>
                      <div className="flex justify-end gap-1">
                        {draftList && isAdmin ? (
                          <>
                            <Button size="sm" variant="outline" onClick={() => setPending({ item, action: "approve" })}>
                              <Check className="mr-1 h-3.5 w-3.5" /> Approve
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => setPending({ item, action: "reject" })}>
                              <X className="mr-1 h-3.5 w-3.5" /> Reject
                            </Button>
                          </>
                        ) : null}
                        <Button size="icon" variant="ghost" onClick={() => openEdit(item)} aria-label={`Edit ${item.name}`}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => setPending({ item, action: "delete" })} aria-label={`Delete ${item.name}`}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>Showing {visible.length} products</span>
            <div className="flex gap-1">
              <Button variant="outline" size="sm" disabled={currentPage === 0} onClick={() => setPageIndex(currentPage - 1)}>Previous</Button>
              <Button variant="outline" size="sm" disabled={currentPage >= pageCount - 1} onClick={() => setPageIndex(currentPage + 1)}>Next</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Bulk import</CardTitle>
          <CardDescription>
            Paste CSV or JSON. New rows are saved as drafts. Matching ids are updated and keep their status. Older files that still say batch_id or batch_qty are read as group_id and group_qty.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            value={importText}
            onChange={(event) => setImportText(event.target.value)}
            placeholder="Paste a CSV with a header row, or a JSON list."
            rows={6}
          />
          <Button onClick={() => void onImport()} disabled={importing || !importText.trim()}>
            {importing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Import
          </Button>
        </CardContent>
      </Card>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit item" : "Add one item"}</DialogTitle>
          </DialogHeader>
          <form className="grid gap-3 sm:grid-cols-2" onSubmit={(event) => void onSave(event)}>
            <Field label="Name">
              <Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
            </Field>
            <Field label="Id">
              <Input
                value={form.id}
                onChange={(event) => setForm({ ...form, id: event.target.value })}
                placeholder="Leave blank to auto-generate"
                readOnly={Boolean(editingId)}
              />
            </Field>
            {!editingId ? (
              <div className="sm:col-span-2">
                <Button type="button" variant="link" className="h-auto px-0" onClick={() => setForm({ ...form, id: slugifyId(form.name) })}>
                  Make id from name
                </Button>
              </div>
            ) : null}
            <ChoiceField label="Brand" value={form.brand} choices={uniqueNames(["NA", ...brands])} onChange={(brand) => setForm({ ...form, brand })} />
            <ChoiceField label="Category" value={form.category} choices={categories} required onChange={(category) => setForm({ ...form, category })} />
            <ChoiceField label="Group name" value={form.group_name} choices={groups} required onChange={(group_name) => setForm({ ...form, group_name })} />
            <Field label="Department">
              <Select value={form.department} onValueChange={(department) => setForm({ ...form, department })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DEPARTMENTS.map((department) => (
                    <SelectItem key={department} value={department}>{department}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Unit">
              <Input value={form.unit} onChange={(event) => setForm({ ...form, unit: event.target.value })} required />
            </Field>
            <Field label="Price (₹)">
              <Input inputMode="decimal" value={form.price} onChange={(event) => setForm({ ...form, price: event.target.value })} required />
            </Field>
            <Field label="Quantity (group_qty)">
              <Input inputMode="numeric" value={form.group_qty} onChange={(event) => setForm({ ...form, group_qty: event.target.value })} required />
            </Field>
            <Field label="Sort order">
              <Input inputMode="numeric" value={form.sort_order} onChange={(event) => setForm({ ...form, sort_order: event.target.value })} />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Image URL">
                <Input value={form.image} onChange={(event) => setForm({ ...form, image: event.target.value })} placeholder="https://..." required />
              </Field>
            </div>
            <Field label="Tag">
              <Input value={form.tag} onChange={(event) => setForm({ ...form, tag: event.target.value })} />
            </Field>
            <Field label="Group id">
              <Input value={form.group_id} onChange={(event) => setForm({ ...form, group_id: event.target.value })} placeholder="Leave blank to keep the current value" />
            </Field>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.is_active} onChange={(event) => setForm({ ...form, is_active: event.target.checked })} />
              Active
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.in_stock} onChange={(event) => setForm({ ...form, in_stock: event.target.checked })} />
              In stock
            </label>
            <DialogFooter className="sm:col-span-2">
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)} disabled={saving}>Cancel</Button>
              <Button type="submit" disabled={saving}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {editingId ? "Save changes" : "Save item"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(pending)} onOpenChange={(open) => { if (!open && !busy) setPending(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pending?.action === "approve" ? "Approve catalog item" : pending?.action === "reject" ? "Reject catalog item" : "Delete catalog item"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pending?.action === "approve"
                ? `Approve ${pending.item.name}? Its status becomes live and it shows on Catalog Items.`
                : pending?.action === "reject"
                  ? `Reject ${pending.item.name}? It leaves Draft Catalog and stays off Catalog Items.`
                  : `Delete ${pending?.item.name}? It will be removed from this Firebase catalog.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={busy} onClick={(event) => { event.preventDefault(); void confirmPending() }}>
              {pending?.action === "approve" ? "Approve" : pending?.action === "reject" ? "Reject" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="text-2xl font-semibold">{value}</p>
      </CardContent>
    </Card>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  )
}

function ChoiceField({
  label,
  value,
  choices,
  required,
  onChange,
}: {
  label: string
  value: string
  choices: string[]
  required?: boolean
  onChange: (value: string) => void
}) {
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState("")
  const known = choices.includes(value) ? value : ""
  return (
    <Field label={label}>
      {adding ? (
        <div className="flex gap-2">
          <Input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={`New ${label.toLowerCase()}`} />
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              const next = draft.trim()
              if (!next) return
              onChange(next)
              setAdding(false)
              setDraft("")
            }}
          >
            Use
          </Button>
        </div>
      ) : (
        <Select
          value={known || (value ? value : undefined)}
          onValueChange={(next) => {
            if (next === "__new") {
              setAdding(true)
              setDraft("")
              return
            }
            onChange(next)
          }}
          required={required}
        >
          <SelectTrigger><SelectValue placeholder={`Select ${label.toLowerCase()}`} /></SelectTrigger>
          <SelectContent>
            {!known && value ? <SelectItem value={value}>{value}</SelectItem> : null}
            {choices.map((choice) => (
              <SelectItem key={choice} value={choice}>{choice}</SelectItem>
            ))}
            <SelectItem value="__new">Add new…</SelectItem>
          </SelectContent>
        </Select>
      )}
    </Field>
  )
}
