"use client"

import { useEffect, useState } from "react"
import { Pencil, Trash2, Check, X } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  masterPlanCategoryName,
  isBuiltinCategoryId,
  type MasterPlanCategoryOption,
} from "@/lib/features/master-plan/constants"
import type { MasterPlanBranch, MasterPlanItem, MasterPlanItemInput } from "@/lib/features/master-plan/models"
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

type ItemDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  item: MasterPlanItem | null
  categories: MasterPlanCategoryOption[]
  onSave: (input: MasterPlanItemInput) => Promise<void>
}

const emptyForm: MasterPlanItemInput = {
  category: "Groceries",
  name: "",
  brand: "",
  size: "",
  whls: 0,
  mrp: 0,
  qty: 0,
}

function itemToForm(item: MasterPlanItem): MasterPlanItemInput {
  return {
    category: item.category,
    name: item.name,
    brand: item.brand,
    size: item.size,
    whls: item.whls,
    mrp: item.mrp,
    qty: item.qty,
  }
}

export function MasterPlanItemDialog({ open, onOpenChange, item, categories, onSave }: ItemDialogProps) {
  const [form, setForm] = useState<MasterPlanItemInput>(emptyForm)
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setForm(item ? itemToForm(item) : emptyForm)
    setError("")
  }, [open, item])

  const handleOpenChange = (next: boolean) => {
    onOpenChange(next)
  }

  const handleSave = async () => {
    if (!form.name.trim()) {
      setError("Please enter a valid Product Name.")
      return
    }
    setSaving(true)
    try {
      await onSave({
        ...form,
        name: form.name.trim(),
        brand: form.brand.trim(),
        size: form.size.trim(),
      })
      onOpenChange(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{item ? "Edit item" : "Add new item"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {error ? (
            <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              <span className="font-semibold">Error:</span>
              <span>{error}</span>
            </div>
          ) : null}

          <div>
            <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Category
            </Label>
            <Select
              value={form.category}
              onValueChange={(v) => setForm((f) => ({ ...f, category: v }))}
            >
              <SelectTrigger className="mt-1.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Product Name
            </Label>
            <Input
              className="mt-1.5"
              placeholder="e.g. Premium Basmati Rice"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Top Brands
              </Label>
              <Input
                className="mt-1.5"
                placeholder="e.g. India Gate"
                value={form.brand}
                onChange={(e) => setForm((f) => ({ ...f, brand: e.target.value }))}
              />
            </div>
            <div>
              <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Pack Size / Spec
              </Label>
              <Input
                className="mt-1.5"
                placeholder="e.g. 1 Kg, 500g"
                value={form.size}
                onChange={(e) => setForm((f) => ({ ...f, size: e.target.value }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Wholesale (₹)
              </Label>
              <Input
                type="number"
                step="0.01"
                className="mt-1.5"
                value={form.whls}
                onChange={(e) => setForm((f) => ({ ...f, whls: parseFloat(e.target.value) || 0 }))}
              />
            </div>
            <div>
              <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                MRP (₹)
              </Label>
              <Input
                type="number"
                step="0.01"
                className="mt-1.5"
                value={form.mrp}
                onChange={(e) => setForm((f) => ({ ...f, mrp: parseFloat(e.target.value) || 0 }))}
              />
            </div>
            <div>
              <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Quantity
              </Label>
              <Input
                type="number"
                className="mt-1.5"
                value={form.qty}
                onChange={(e) => setForm((f) => ({ ...f, qty: parseInt(e.target.value, 10) || 0 }))}
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            Save item
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

type BranchDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  branches: MasterPlanBranch[]
  activeBranchId: string | null
  onSelect: (id: string) => void
  onAdd: (name: string) => Promise<void>
  onUpdate: (id: string, name: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
}

export function MasterPlanBranchDialog({
  open,
  onOpenChange,
  branches,
  activeBranchId,
  onSelect,
  onAdd,
  onUpdate,
  onDelete,
}: BranchDialogProps) {
  const [newName, setNewName] = useState("")
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState("")
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (!open) return
    setNewName("")
    setError("")
    setEditingId(null)
    setEditName("")
    setDeletingId(null)
  }, [open])

  const handleAdd = async () => {
    setSaving(true)
    setError("")
    try {
      await onAdd(newName)
      setNewName("")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add branch")
    } finally {
      setSaving(false)
    }
  }

  const startEdit = (branch: MasterPlanBranch) => {
    setEditingId(branch.id)
    setEditName(branch.name)
    setError("")
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditName("")
  }

  const handleUpdate = async (id: string) => {
    setSaving(true)
    setError("")
    try {
      await onUpdate(id, editName)
      setEditingId(null)
      setEditName("")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update branch")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deletingId) return
    setDeleting(true)
    setError("")
    try {
      await onDelete(deletingId)
      setDeletingId(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete branch")
    } finally {
      setDeleting(false)
    }
  }

  const deletingBranch = branches.find((b) => b.id === deletingId)

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Manage branches</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {error ? (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {error}
              </div>
            ) : null}

            <div className="flex gap-2">
              <Input
                placeholder="New branch name (e.g. Stationery)"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newName.trim()) handleAdd()
                }}
              />
              <Button onClick={handleAdd} disabled={saving || !newName.trim()} className="shrink-0">
                Add
              </Button>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                All branches ({branches.length})
              </p>
              <div className="max-h-[320px] space-y-2 overflow-y-auto rounded-lg border border-border/80 p-2">
                {branches.map((branch) => {
                  const isActive = branch.id === activeBranchId
                  const isEditing = editingId === branch.id

                  return (
                    <div
                      key={branch.id}
                      className={cn(
                        "flex items-center gap-2 rounded-lg border px-3 py-2",
                        isActive
                          ? "border-primary/40 bg-primary/5"
                          : "border-border/60 bg-muted/20"
                      )}
                    >
                      {isEditing ? (
                        <Input
                          className="h-8 flex-1"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          autoFocus
                        />
                      ) : (
                        <button
                          type="button"
                          className="min-w-0 flex-1 truncate text-left text-sm font-medium"
                          onClick={() => {
                            onSelect(branch.id)
                            onOpenChange(false)
                          }}
                        >
                          {branch.name}
                        </button>
                      )}
                      {isActive && !isEditing ? (
                        <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                          Active
                        </span>
                      ) : null}
                      {branch.isDefault && !isEditing ? (
                        <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                          Default
                        </span>
                      ) : null}
                      <div className="flex shrink-0 items-center gap-1">
                        {isEditing ? (
                          <>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-emerald-600"
                              disabled={saving || !editName.trim()}
                              onClick={() => handleUpdate(branch.id)}
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={cancelEdit}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => startEdit(branch)}
                            >
                              <Pencil className="h-4 w-4" />
                              <span className="sr-only">Edit</span>
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              disabled={branches.length <= 1}
                              onClick={() => setDeletingId(branch.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                              <span className="sr-only">Delete</span>
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingId} onOpenChange={(open) => !open && setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">Delete branch?</AlertDialogTitle>
            <AlertDialogDescription>
              Delete &quot;{deletingBranch?.name}&quot; and all its items? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              disabled={deleting}
              onClick={async (e) => {
                e.preventDefault()
                await handleDelete()
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

type CategoryDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  categories: MasterPlanCategoryOption[]
  onAdd: (name: string) => Promise<void>
  onUpdate: (id: string, name: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
}

export function MasterPlanCategoryDialog({
  open,
  onOpenChange,
  categories,
  onAdd,
  onUpdate,
  onDelete,
}: CategoryDialogProps) {
  const [newName, setNewName] = useState("")
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState("")
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (!open) return
    setNewName("")
    setError("")
    setEditingId(null)
    setEditName("")
    setDeletingId(null)
  }, [open])

  const handleAdd = async () => {
    setSaving(true)
    setError("")
    try {
      await onAdd(newName)
      setNewName("")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add category")
    } finally {
      setSaving(false)
    }
  }

  const startEdit = (cat: MasterPlanCategoryOption) => {
    setEditingId(cat.id)
    setEditName(cat.name)
    setError("")
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditName("")
  }

  const handleUpdate = async (id: string) => {
    setSaving(true)
    setError("")
    try {
      await onUpdate(id, editName)
      setEditingId(null)
      setEditName("")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update category")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deletingId) return
    setDeleting(true)
    setError("")
    try {
      await onDelete(deletingId)
      setDeletingId(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete category")
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Manage categories</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {error ? (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {error}
              </div>
            ) : null}

            <div className="flex gap-2">
              <Input
                placeholder="New category name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newName.trim()) handleAdd()
                }}
              />
              <Button onClick={handleAdd} disabled={saving || !newName.trim()} className="shrink-0">
                Add
              </Button>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                All categories ({categories.length})
              </p>
              <div className="max-h-[320px] space-y-2 overflow-y-auto rounded-lg border border-border/80 p-2">
                {categories.map((cat) => {
                  const isEditing = editingId === cat.id
                  const isCustom = cat.isCustom && !isBuiltinCategoryId(cat.id)

                  return (
                    <div
                      key={cat.id}
                      className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/20 px-3 py-2"
                    >
                      <div
                        className="h-3 w-3 shrink-0 rounded-full"
                        style={{ backgroundColor: cat.color }}
                      />
                      {isEditing ? (
                        <Input
                          className="h-8 flex-1"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          autoFocus
                        />
                      ) : (
                        <span className="min-w-0 flex-1 truncate text-sm font-medium">{cat.name}</span>
                      )}
                      {!isCustom ? (
                        <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                          Default
                        </span>
                      ) : null}
                      <div className="flex shrink-0 items-center gap-1">
                        {isCustom ? (
                          isEditing ? (
                            <>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-emerald-600"
                                disabled={saving || !editName.trim()}
                                onClick={() => handleUpdate(cat.id)}
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={cancelEdit}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => startEdit(cat)}
                              >
                                <Pencil className="h-4 w-4" />
                                <span className="sr-only">Edit</span>
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:text-destructive"
                                onClick={() => setDeletingId(cat.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                                <span className="sr-only">Delete</span>
                              </Button>
                            </>
                          )
                        ) : null}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingId} onOpenChange={(open) => !open && setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">Delete category?</AlertDialogTitle>
            <AlertDialogDescription>
              Delete &quot;
              {masterPlanCategoryName(deletingId ?? "", categories)}
              &quot;? Items using this category must be moved first.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              disabled={deleting}
              onClick={async (e) => {
                e.preventDefault()
                await handleDelete()
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

type DeleteDialogProps = {
  item: MasterPlanItem | null
  onOpenChange: (open: boolean) => void
  onConfirm: () => Promise<void>
}

export function MasterPlanDeleteDialog({ item, onOpenChange, onConfirm }: DeleteDialogProps) {
  const [deleting, setDeleting] = useState(false)

  return (
    <AlertDialog open={!!item} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-destructive">
            Remove item?
          </AlertDialogTitle>
          <AlertDialogDescription>
            Delete &quot;{item?.name}&quot; from the master plan? This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-red-600 hover:bg-red-700"
            disabled={deleting}
            onClick={async (e) => {
              e.preventDefault()
              setDeleting(true)
              try {
                await onConfirm()
                onOpenChange(false)
              } finally {
                setDeleting(false)
              }
            }}
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

export function itemMargin(mrp: number, whls: number): number {
  return mrp > 0 ? ((mrp - whls) / mrp) * 100 : 0
}

export function formatInr(amount: number, decimals = 0): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: decimals,
    minimumFractionDigits: decimals,
  }).format(amount)
}

export { masterPlanCategoryName }
