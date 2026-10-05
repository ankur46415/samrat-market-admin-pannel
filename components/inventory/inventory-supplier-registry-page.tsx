"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Loader2, Package, Pencil, Phone, Plus, Trash2 } from "lucide-react"
import type { SupplierRegistryItem } from "@/hooks/use-product-supplier-registry"

type InventorySupplierRegistryPageProps = {
  title: string
  description: string
  emptyHint: string
  items: SupplierRegistryItem[]
  loading: boolean
  addSupplier: (name: string, contact: string) => Promise<void>
  updateSupplier: (oldName: string, name: string, contact: string) => Promise<void>
  deleteSupplier: (name: string, moveProductsTo?: string) => Promise<number | void>
  embedded?: boolean
}

export function InventorySupplierRegistryPage({
  title,
  description,
  emptyHint,
  items,
  loading,
  addSupplier,
  updateSupplier,
  deleteSupplier,
  embedded = false,
}: InventorySupplierRegistryPageProps) {
  const [dialogMode, setDialogMode] = useState<"create" | "edit" | null>(null)
  const [editOriginalName, setEditOriginalName] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<{ name: string; productCount: number } | null>(
    null
  )
  const [moveToName, setMoveToName] = useState("")
  const [nameDraft, setNameDraft] = useState("")
  const [contactDraft, setContactDraft] = useState("")
  const [saving, setSaving] = useState(false)

  const swapOptions =
    deleteTarget == null
      ? []
      : items
          .map((c) => c.name)
          .filter((name) => name !== deleteTarget.name)
          .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }))

  const openCreate = () => {
    setNameDraft("")
    setContactDraft("")
    setEditOriginalName(null)
    setDialogMode("create")
  }

  const openEdit = (item: SupplierRegistryItem) => {
    setEditOriginalName(item.name)
    setNameDraft(item.name)
    setContactDraft(item.contact)
    setDialogMode("edit")
  }

  const closeDialog = () => {
    setDialogMode(null)
    setEditOriginalName(null)
    setNameDraft("")
    setContactDraft("")
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      if (dialogMode === "create") {
        await addSupplier(nameDraft, contactDraft)
        toast.success(`Supplier "${nameDraft.trim()}" added`)
      } else if (dialogMode === "edit" && editOriginalName) {
        await updateSupplier(editOriginalName, nameDraft, contactDraft)
        toast.success("Supplier updated — linked products refreshed")
      }
      closeDialog()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setSaving(true)
    try {
      const moved = await deleteSupplier(
        deleteTarget.name,
        deleteTarget.productCount > 0 ? moveToName : undefined
      )
      if (typeof moved === "number" && moved > 0) {
        toast.success(
          `Moved ${moved} product${moved === 1 ? "" : "s"} to "${moveToName.trim()}" and removed supplier`
        )
      } else {
        toast.success(`Removed "${deleteTarget.name}"`)
      }
      setDeleteTarget(null)
      setMoveToName("")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={embedded ? "space-y-6" : "mx-auto max-w-6xl space-y-8 pb-10"}>
      {!embedded ? (
        <div className="space-y-1.5 border-b border-border/60 pb-6">
          <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      ) : null}

      <Card className="border-border/80 shadow-sm">
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-4 space-y-0">
          <div>
            <CardTitle className="text-lg">{embedded ? title : "Suppliers"}</CardTitle>
            {embedded ? (
              <p className="mt-1 text-sm text-muted-foreground">{description}</p>
            ) : null}
          </div>
          <Button type="button" size="sm" className="gap-1.5" onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Add supplier
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-28 rounded-xl" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border/80 bg-muted/20 px-4 py-10 text-center text-sm text-muted-foreground">
              {emptyHint}
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="flex flex-col gap-3 rounded-xl border border-border/70 bg-card p-4 shadow-sm"
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="truncate font-semibold text-foreground">{item.name}</p>
                    <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <Phone className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
                      <span className="truncate">{item.contact || "—"}</span>
                    </p>
                    <Badge variant="secondary" className="mt-1 gap-1 font-normal tabular-nums">
                      <Package className="h-3 w-3" />
                      {item.productCount} product{item.productCount === 1 ? "" : "s"}
                    </Badge>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => openEdit(item)}
                    >
                      <Pencil className="mr-1 h-3.5 w-3.5" />
                      Edit
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() =>
                        setDeleteTarget({ name: item.name, productCount: item.productCount })
                      }
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogMode != null} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{dialogMode === "edit" ? "Edit supplier" : "Add supplier"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="supplier-registry-name">Supplier name</Label>
              <Input
                id="supplier-registry-name"
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                placeholder="e.g. ABC Traders"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="supplier-registry-contact">Contact (phone / person)</Label>
              <Input
                id="supplier-registry-contact"
                value={contactDraft}
                onChange={(e) => setContactDraft(e.target.value)}
                placeholder="e.g. 9876543210"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={closeDialog} disabled={saving}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void handleSave()} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete supplier?</DialogTitle>
          </DialogHeader>
          {deleteTarget ? (
            <div className="space-y-4 text-sm">
              <p>
                Remove <span className="font-medium">{deleteTarget.name}</span> from the list.
              </p>
              {deleteTarget.productCount > 0 ? (
                <div className="space-y-2">
                  <p className="text-muted-foreground">
                    {deleteTarget.productCount} product
                    {deleteTarget.productCount === 1 ? "" : "s"} use this supplier. Move them to:
                  </p>
                  <Select value={moveToName} onValueChange={setMoveToName}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose supplier" />
                    </SelectTrigger>
                    <SelectContent>
                      {swapOptions.map((name) => (
                        <SelectItem key={name} value={name}>
                          {name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}
            </div>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={
                saving ||
                (!!deleteTarget &&
                  deleteTarget.productCount > 0 &&
                  !moveToName.trim())
              }
              onClick={() => void handleDelete()}
            >
              {saving ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
