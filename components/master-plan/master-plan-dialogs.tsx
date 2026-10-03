"use client"

import { useEffect, useState } from "react"
import { Pencil, Trash2, Check, X } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  masterPlanCategoryName,
  type MasterPlanCategoryOption,
} from "@/lib/features/master-plan/constants"
import type { MasterPlanBranch, MasterPlanItem, MasterPlanItemInput } from "@/lib/features/master-plan/models"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import * as XLSX from "xlsx"
import Papa from "papaparse"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet"
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

const emptyForm = (): MasterPlanItemInput => ({
  category: "",
  name: "",
  brand: "",
  size: "",
  whls: 0,
  mrp: 0,
  qty: 0,
})

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
    if (item) {
      setForm(itemToForm(item))
    } else {
      setForm({
        ...emptyForm(),
        category: categories[0]?.id ?? "",
      })
    }
    setError("")
  }, [open, item, categories])

  const handleOpenChange = (next: boolean) => {
    onOpenChange(next)
  }

  const handleSave = async () => {
    if (!form.name.trim()) {
      setError("Please enter a valid Product Name.")
      return
    }
    if (!form.category) {
      setError("Please add a category for this branch first.")
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
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent className="w-full sm:w-[500px] md:w-[40vw] md:max-w-[40vw] overflow-y-auto px-6 sm:px-10">
        <SheetHeader>
          <SheetTitle>{item ? "Edit item" : "Add new item"}</SheetTitle>
        </SheetHeader>
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
        <SheetFooter className="mt-6 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            Save item
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
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
            <DialogTitle>Manage categories — this branch only</DialogTitle>
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
                      <div className="flex shrink-0 items-center gap-1">
                        {isEditing ? (
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

type BulkImportDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  categories: MasterPlanCategoryOption[]
  onSaveBulk: (inputs: MasterPlanItemInput[]) => Promise<void>
}

export function MasterPlanBulkImportDialog({
  open,
  onOpenChange,
  categories,
  onSaveBulk,
}: BulkImportDialogProps) {
  const [activeTab, setActiveTab] = useState<"excel" | "json">("excel")
  const [jsonText, setJsonText] = useState("")
  const [parsedItems, setParsedItems] = useState<MasterPlanItemInput[]>([])
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)
  const [fileName, setFileName] = useState("")

  useEffect(() => {
    if (!open) return
    setJsonText("")
    setParsedItems([])
    setError("")
    setFileName("")
    setActiveTab("excel")
  }, [open])

  const handleApplyJson = () => {
    setError("")
    if (!jsonText.trim()) {
      setError("Please paste a JSON array of items first.")
      return
    }
    try {
      const parsed = JSON.parse(jsonText.trim())
      if (!Array.isArray(parsed)) {
        setError("Invalid JSON: Input must be a JSON array of items.")
        return
      }

      const items: MasterPlanItemInput[] = parsed.map((item: any, idx: number) => {
        if (!item.name || !String(item.name).trim()) {
          throw new Error(`Item at index ${idx} is missing a product "name".`)
        }
        
        let categoryId = categories[0]?.id ?? ""
        if (item.category) {
          const categoryVal = String(item.category).trim().toLowerCase()
          const found = categories.find(
            (c) =>
              c.id.toLowerCase() === categoryVal ||
              c.name.toLowerCase() === categoryVal
          )
          if (found) {
            categoryId = found.id
          } else {
            categoryId = item.category
          }
        }

        return {
          category: categoryId,
          name: String(item.name).trim(),
          brand: item.brand ? String(item.brand).trim() : "",
          size: item.size ? String(item.size).trim() : "",
          whls: typeof item.whls === "number" ? item.whls : parseFloat(item.whls) || 0,
          mrp: typeof item.mrp === "number" ? item.mrp : parseFloat(item.mrp) || 0,
          qty: typeof item.qty === "number" ? item.qty : parseInt(item.qty, 10) || 0,
        }
      })

      setParsedItems(items)
      setError("")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to parse JSON. Please check your syntax.")
    }
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError("")
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)

    const fileExt = file.name.split(".").pop()?.toLowerCase()

    if (fileExt === "csv") {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          try {
            processParsedData(results.data)
          } catch (err) {
            setError(err instanceof Error ? err.message : "Error parsing CSV file.")
          }
        },
        error: () => {
          setError("Error reading CSV file.")
        },
      })
    } else if (fileExt === "xlsx" || fileExt === "xls") {
      const reader = new FileReader()
      reader.onload = (evt) => {
        try {
          const data = new Uint8Array(evt.target?.result as ArrayBuffer)
          const workbook = XLSX.read(data, { type: "array" })
          const sheetName = workbook.SheetNames[0]
          const worksheet = workbook.Sheets[sheetName]
          const json = XLSX.utils.sheet_to_json(worksheet)
          processParsedData(json)
        } catch (err) {
          setError(err instanceof Error ? err.message : "Error parsing Excel file.")
        }
      }
      reader.onerror = () => {
        setError("Error reading Excel file.")
      }
      reader.readAsArrayBuffer(file)
    } else {
      setError("Unsupported file format. Please upload an Excel (.xlsx, .xls) or CSV (.csv) file.")
    }
  }

  const processParsedData = (data: any[]) => {
    const items: MasterPlanItemInput[] = data.map((row: any, idx: number) => {
      const findValue = (keys: string[]) => {
        const matchedKey = Object.keys(row).find((k) =>
          keys.includes(k.trim().toLowerCase())
        )
        return matchedKey ? row[matchedKey] : undefined
      }

      const name = findValue(["name", "product name", "item name", "item", "product"])
      const categoryName = findValue(["category", "category name", "cat"])
      const brand = findValue(["brand", "top brands", "brands"]) || ""
      const size = findValue(["size", "pack size", "spec", "pack size / spec"]) || ""
      const whls = parseFloat(findValue(["whls", "wholesale", "wholesale (₹)", "wholesale price"]) || "0") || 0
      const mrp = parseFloat(findValue(["mrp", "mrp (₹)", "mrp price"]) || "0") || 0
      const qty = parseInt(findValue(["qty", "quantity", "quantity count", "count"]) || "0", 10) || 0

      if (!name || !String(name).trim()) {
        throw new Error(`Row ${idx + 2} is missing a Product Name column or has an empty name.`)
      }

      let categoryId = categories[0]?.id ?? ""
      if (categoryName) {
        const cName = String(categoryName).trim().toLowerCase()
        const found = categories.find(
          (c) =>
            c.id.toLowerCase() === cName ||
            c.name.toLowerCase() === cName
        )
        if (found) {
          categoryId = found.id
        } else {
          categoryId = String(categoryName).trim()
        }
      }

      return {
        category: categoryId,
        name: String(name).trim(),
        brand: String(brand).trim(),
        size: String(size).trim(),
        whls,
        mrp,
        qty,
      }
    })

    setParsedItems(items)
    setError("")
  }

  const downloadCsvTemplate = () => {
    const headers = ["Category", "Product Name", "Brand", "Pack Size", "Wholesale Price", "MRP", "Quantity"]
    const sampleRows = [
      ["Groceries", "Premium Basmati Rice", "India Gate", "5 Kg", "450.00", "550.00", "10"],
      ["Snacks", "Potato Chips", "Lay's", "50g", "15.00", "20.00", "100"],
    ]
    
    const csvContent = [
      headers.join(","),
      ...sampleRows.map(row => row.map(val => `"${val.replace(/"/g, '""')}"`).join(","))
    ].join("\n")
    
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.setAttribute("href", url)
    link.setAttribute("download", "master_plan_items_template.csv")
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handleSave = async () => {
    if (parsedItems.length === 0) {
      setError("Please add or upload some items first.")
      return
    }
    setSaving(true)
    try {
      await onSaveBulk(parsedItems)
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to import items.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[95vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import Multiple Items</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {error ? (
            <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              <span className="font-semibold">Error:</span>
              <span>{error}</span>
            </div>
          ) : null}

          <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="excel">Excel / CSV File</TabsTrigger>
              <TabsTrigger value="json">JSON Array</TabsTrigger>
            </TabsList>
            
            <TabsContent value="excel" className="space-y-4 pt-3">
              <div className="flex flex-col items-center justify-center border-2 border-dashed border-border rounded-lg p-6 bg-muted/20 text-center hover:bg-muted/30 transition-colors">
                <Input
                  id="excel-file-input"
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={handleFileUpload}
                />
                <label htmlFor="excel-file-input" className="cursor-pointer space-y-2">
                  <div className="text-sm font-semibold text-primary hover:underline">
                    {fileName ? `Selected: ${fileName}` : "Click to select Excel (.xlsx, .xls) or CSV (.csv)"}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Excel columns: Category, Product Name, Brand, Pack Size, Wholesale Price, MRP, Quantity
                  </p>
                </label>
              </div>

              <div className="flex justify-between items-center bg-muted/40 p-3 rounded-lg border">
                <div className="text-xs text-muted-foreground">
                  Need a starting point? Download our sample spreadsheet template.
                </div>
                <Button type="button" variant="outline" size="sm" onClick={downloadCsvTemplate}>
                  Download Template
                </Button>
              </div>
            </TabsContent>
            
            <TabsContent value="json" className="space-y-3 pt-3">
              <div>
                <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Paste JSON Array of Items
                </Label>
                <Textarea
                  className="mt-1.5 font-mono text-xs focus-visible:ring-1"
                  placeholder={`[\n  {\n    "name": "Premium Basmati Rice",\n    "category": "Groceries",\n    "brand": "India Gate",\n    "size": "5 Kg",\n    "whls": 450,\n    "mrp": 550,\n    "qty": 10\n  }\n]`}
                  rows={8}
                  value={jsonText}
                  onChange={(e) => setJsonText(e.target.value)}
                />
              </div>
              <Button type="button" variant="secondary" className="w-full text-xs" onClick={handleApplyJson}>
                Parse & Preview JSON
              </Button>
            </TabsContent>
          </Tabs>

          {parsedItems.length > 0 && (
            <div className="space-y-2 pt-2 border-t">
              <div className="flex justify-between items-center">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Preview Items ({parsedItems.length})
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-xs text-destructive hover:bg-destructive/10"
                  onClick={() => setParsedItems([])}
                >
                  Clear
                </Button>
              </div>
              <div className="max-h-[250px] overflow-y-auto rounded-lg border border-border bg-card">
                <Table>
                  <TableHeader className="bg-muted/50 sticky top-0">
                    <TableRow>
                      <TableHead>Product Name</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead className="text-right">Wholesale</TableHead>
                      <TableHead className="text-right">MRP</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsedItems.map((item, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="font-medium text-xs">
                          <div>{item.name}</div>
                          {(item.brand || item.size) && (
                            <div className="text-[10px] text-muted-foreground">
                              {item.brand} {item.size ? `(${item.size})` : ""}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-xs">
                          <Badge variant="outline" className="text-[10px]">
                            {masterPlanCategoryName(item.category, categories)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right text-xs tabular-nums">
                          ₹{item.whls.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right text-xs tabular-nums">
                          ₹{item.mrp.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right text-xs tabular-nums">{item.qty}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="mt-4 border-t pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || parsedItems.length === 0}>
            {saving ? "Importing..." : `Import ${parsedItems.length} Items`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export { masterPlanCategoryName }
