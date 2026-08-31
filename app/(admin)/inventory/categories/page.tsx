"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { useCategories, useProducts } from "@/hooks/use-firestore"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Loader2, Package, Pencil, Plus } from "lucide-react"

export default function CategoriesPage() {
  const { categories, loading, addCategory, renameCategory } = useCategories()
  const { products } = useProducts()
  const [createOpen, setCreateOpen] = useState(false)
  const [renameFrom, setRenameFrom] = useState<string | null>(null)
  const [nameDraft, setNameDraft] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get("new") === "1") setCreateOpen(true)
  }, [])

  const getCategoryValue = (categoryName: string) => {
    const categoryProducts = products.filter((p) => p.category === categoryName)
    return categoryProducts.reduce((sum, p) => sum + p.price * p.stock, 0)
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount)
  }

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
      await addCategory(nameDraft)
      toast.success(`Category "${nameDraft.trim()}" created`)
      setCreateOpen(false)
      setNameDraft("")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create category")
    } finally {
      setSaving(false)
    }
  }

  const handleRename = async () => {
    if (!renameFrom) return
    setSaving(true)
    try {
      const next = nameDraft.trim()
      await renameCategory(renameFrom, next)
      toast.success(`Category renamed to "${next}". Related products were updated.`)
      setRenameFrom(null)
      setNameDraft("")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to rename category")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-4 w-48 mt-2" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Categories</h1>
          <p className="text-muted-foreground">
            Create categories and rename them — products move with the new name
          </p>
        </div>
        <Button className="gap-2 shrink-0" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          New Category
        </Button>
      </div>

      {categories.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Package className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No categories found</p>
            <p className="text-sm text-muted-foreground mb-4">
              Create a category, or add products to create one automatically
            </p>
            <Button onClick={openCreate} className="gap-2">
              <Plus className="h-4 w-4" />
              New Category
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {categories.map((category) => {
            const value = getCategoryValue(category.name)
            return (
              <Card key={category.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-lg">{category.name}</CardTitle>
                    <div className="flex items-center gap-1">
                      <Badge variant="secondary">{category.productCount} items</Badge>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0"
                        onClick={() => openRename(category.name)}
                        title="Rename category"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <CardDescription>
                    Stock Value: {formatCurrency(value)}
                  </CardDescription>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>New Category</DialogTitle>
          </DialogHeader>
          <div className="space-y-1.5 py-1">
            <Label htmlFor="new-category-name">Category name</Label>
            <Input
              id="new-category-name"
              placeholder="e.g. Stationery"
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  void handleCreate()
                }
              }}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={() => void handleCreate()} disabled={saving || !nameDraft.trim()}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={renameFrom != null} onOpenChange={(open) => !open && setRenameFrom(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Rename category</DialogTitle>
          </DialogHeader>
          <div className="space-y-1.5 py-1">
            <Label htmlFor="rename-category-name">New name</Label>
            <Input
              id="rename-category-name"
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  void handleRename()
                }
              }}
            />
            <p className="text-xs text-muted-foreground">
              All products in &ldquo;{renameFrom}&rdquo; will be moved to this name.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameFrom(null)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={() => void handleRename()} disabled={saving || !nameDraft.trim()}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
