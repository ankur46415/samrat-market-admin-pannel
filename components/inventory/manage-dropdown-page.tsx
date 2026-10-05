"use client"

import { Suspense, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { ListTree } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { InventoryNamedListPage } from "@/components/inventory/inventory-named-list-page"
import { InventorySupplierRegistryPage } from "@/components/inventory/inventory-supplier-registry-page"
import { useProductBrands, useProductTags } from "@/hooks/use-firestore"
import { useProductSupplierRegistry } from "@/hooks/use-product-supplier-registry"

const BASE_PATH = "/manage-dropdown"

type DropdownTab = "brands" | "tags" | "suppliers"

function parseDropdownTab(raw: string | null): DropdownTab {
  if (raw === "tags") return "tags"
  if (raw === "suppliers" || raw === "supplier-names" || raw === "supplier-contacts") {
    return "suppliers"
  }
  if (raw === "brands") return "brands"
  return "brands"
}

function ManageDropdownContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const paramTab = searchParams.get("tab")
  const [tab, setTab] = useState<DropdownTab>(() => parseDropdownTab(paramTab))

  const brands = useProductBrands()
  const tags = useProductTags()
  const suppliers = useProductSupplierRegistry()

  useEffect(() => {
    setTab(parseDropdownTab(paramTab))
  }, [paramTab])

  const onTabChange = (value: string) => {
    const next = parseDropdownTab(value)
    setTab(next)
    router.replace(`${BASE_PATH}?tab=${next}`, { scroll: false })
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8 pb-10">
      <div className="space-y-1.5 border-b border-border/60 pb-6">
        <div className="flex items-center gap-2 text-primary">
          <ListTree className="h-6 w-6" aria-hidden />
          <span className="text-sm font-medium uppercase tracking-wide">Inventory</span>
        </div>
        <h1 className="text-3xl font-semibold tracking-tight">Manage Dropdown</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Add values here for Brand, Tag, and Suppliers (name + contact together). Product forms
          pick a supplier name — contact fills in automatically.
        </p>
      </div>

      <Tabs value={tab} onValueChange={onTabChange} className="w-full">
        <TabsList className="mb-6 grid h-auto w-full grid-cols-3 gap-1 rounded-xl bg-muted/60 p-1.5">
          <TabsTrigger
            value="brands"
            className="rounded-lg py-2.5 text-xs sm:text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm"
          >
            Brand
          </TabsTrigger>
          <TabsTrigger
            value="tags"
            className="rounded-lg py-2.5 text-xs sm:text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm"
          >
            Tag
          </TabsTrigger>
          <TabsTrigger
            value="suppliers"
            className="rounded-lg py-2.5 text-xs sm:text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm"
          >
            Suppliers
          </TabsTrigger>
        </TabsList>

        <TabsContent value="brands" className="mt-0 focus-visible:outline-none">
          <InventoryNamedListPage
            title="Brands"
            description="Brand dropdown on Add/Edit product"
            emptyHint="No brands yet — add one, then select it on products"
            items={brands.items}
            loading={brands.loading}
            addItem={brands.addItem}
            renameItem={brands.renameItem}
            deleteItem={brands.deleteItem}
            embedded
          />
        </TabsContent>

        <TabsContent value="tags" className="mt-0 focus-visible:outline-none">
          <InventoryNamedListPage
            title="Tags"
            description="Tag dropdown on Add/Edit product"
            emptyHint="No tags yet — add one, then select it on products"
            items={tags.items}
            loading={tags.loading}
            addItem={tags.addItem}
            renameItem={tags.renameItem}
            deleteItem={tags.deleteItem}
            embedded
          />
        </TabsContent>

        <TabsContent value="suppliers" className="mt-0 focus-visible:outline-none">
          <InventorySupplierRegistryPage
            title="Suppliers"
            description="Each supplier has a name and contact. Products store both when you pick the name."
            emptyHint="No suppliers yet — add name and contact in one dialog"
            items={suppliers.items}
            loading={suppliers.loading}
            addSupplier={suppliers.addSupplier}
            updateSupplier={suppliers.updateSupplier}
            deleteSupplier={suppliers.deleteSupplier}
            embedded
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}

export function ManageDropdownPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <Skeleton className="h-10 w-72" />
          <Skeleton className="h-10 w-96" />
          <div className="grid gap-4 md:grid-cols-3">
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
          </div>
        </div>
      }
    >
      <ManageDropdownContent />
    </Suspense>
  )
}
