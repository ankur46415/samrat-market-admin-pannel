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
import { Loader2, Package, Pencil, Plus, Trash2 } from "lucide-react"

export type NamedListItem = { id: string; name: string; productCount: number }

type InventoryNamedListPageProps = {
  title: string
  description: string
  emptyHint: string
  items: NamedListItem[]
  loading: boolean
  addItem: (name: string) => Promise<void>
  renameItem: (oldName: string, newName: string) => Promise<void>
  deleteItem: (name: string, moveProductsTo?: string) => Promise<number | void>
  /** When true, omit page title block (used inside Dropdown Management tabs). */
  embedded?: boolean
}

export function InventoryNamedListPage({
  title,
  description,
  emptyHint,
  items,
  loading,
  addItem,
  renameItem,
  deleteItem,
  embedded = false,
}: InventoryNamedListPageProps) {
  const [createOpen, setCreateOpen] = useState(false)
  const [renameFrom, setRenameFrom] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<{ name: string; productCount: number } | null>(
    null
  )
  const [moveToName, setMoveToName] = useState("")
  const [nameDraft, setNameDraft] = useState("")
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
    setCreateOpen(true)
  }

  const openRename = (name: string) => {
    setRenameFrom(name)
    setNameDraft(name)
  }

  const handleCreate = async () => {
    setSaving(true)
    try {
      await addItem(nameDraft)
      toast.success(`"${nameDraft.trim()}" added`)
      setCreateOpen(false)
      setNameDraft("")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to add")
    } finally {
      setSaving(false)
    }
  }

  const handleRename = async () => {
    if (!renameFrom) return
    setSaving(true)
    try {
      const next = nameDraft.trim()
      await renameItem(renameFrom, next)
      toast.success(`Renamed to "${next}" — products updated`)
      setRenameFrom(null)
      setNameDraft("")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to rename")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setSaving(true)
    try {
      const moved = await deleteItem(
        deleteTarget.name,
        deleteTarget.productCount > 0 ? moveToName : undefined
      )
      if (typeof moved === "number" && moved > 0) {
        toast.success(
          `Moved ${moved} product${moved === 1 ? "" : "s"} to "${moveToName.trim()}" and removed "${deleteTarget.name}"`
        )
      } else {
        toast.success(`"${deleteTarget.name}" removed`)
      }
      setDeleteTarget(null)
      setMoveToName("")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete")
    } finally {
      setSaving(false)
    }
  }

  const deleteNeedsSwap = (deleteTarget?.productCount ?? 0) > 0
  const canConfirmDelete =
    !deleteNeedsSwap || (moveToName.trim().length > 0 && swapOptions.length > 0)

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-40" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {embedded ? (
          <div>
            <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
        ) : (
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
            <p className="text-muted-foreground">{description}</p>
          </div>
        )}
        <Button className="gap-2 shrink-0" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Add {title.slice(0, -1)}
        </Button>
      </div>

      {items.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Package className="mb-4 h-12 w-12 text-muted-foreground" />
            <p className="text-muted-foreground">{emptyHint}</p>
            <Button onClick={openCreate} className="mt-4 gap-2">
              <Plus className="h-4 w-4" />
              Add
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <Card key={item.id} className="transition-shadow hover:shadow-md">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-lg">{item.name}</CardTitle>
                  <div className="flex items-center gap-1">
                    <Badge variant="secondary">{item.productCount} items</Badge>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openRename(item.name)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive"
                      onClick={() => {
                        setDeleteTarget({ name: item.name, productCount: item.productCount })
                        setMoveToName("")
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add {title.slice(0, -1)}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="list-name">Name</Label>
            <Input
              id="list-name"
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              placeholder="Name"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={() => void handleCreate()} disabled={saving || !nameDraft.trim()}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={renameFrom != null} onOpenChange={(o) => !o && setRenameFrom(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="rename-name">Name</Label>
            <Input
              id="rename-name"
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameFrom(null)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={() => void handleRename()} disabled={saving || !nameDraft.trim()}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Rename
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteTarget != null} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete &quot;{deleteTarget?.name}&quot;?</DialogTitle>
          </DialogHeader>
          {deleteNeedsSwap ? (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                {deleteTarget?.productCount} product(s) use this value. Move them to:
              </p>
              <Select value={moveToName} onValueChange={setMoveToName}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose replacement" />
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
          ) : (
            <p className="text-sm text-muted-foreground">This cannot be undone.</p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={saving}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => void handleDelete()}
              disabled={saving || !canConfirmDelete}
            >
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
