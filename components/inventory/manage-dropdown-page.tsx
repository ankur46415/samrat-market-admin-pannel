"use client"

import { Suspense, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { ListTree } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { InventoryNamedListPage } from "@/components/inventory/inventory-named-list-page"
import {
  useProductBrands,
  useProductSupplierContacts,
  useProductSupplierNames,
  useProductTags,
} from "@/hooks/use-firestore"

const BASE_PATH = "/manage-dropdown"

type DropdownTab = "brands" | "tags" | "supplier-names" | "supplier-contacts"

function parseDropdownTab(raw: string | null): DropdownTab {
  if (raw === "tags") return "tags"
  if (raw === "supplier-names") return "supplier-names"
  if (raw === "supplier-contacts") return "supplier-contacts"
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
  const supplierNames = useProductSupplierNames()
  const supplierContacts = useProductSupplierContacts()

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
          Add values here for Brand, Tag, Supplier name, and Supplier contact. Product forms only
          allow selections from these lists (or leave empty).
        </p>
      </div>

      <Tabs value={tab} onValueChange={onTabChange} className="w-full">
        <TabsList className="mb-6 grid h-auto w-full grid-cols-2 gap-1 rounded-xl bg-muted/60 p-1.5 lg:grid-cols-4">
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
            value="supplier-names"
            className="rounded-lg py-2.5 text-xs sm:text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm"
          >
            Supplier name
          </TabsTrigger>
          <TabsTrigger
            value="supplier-contacts"
            className="rounded-lg py-2.5 text-xs sm:text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm"
          >
            Supplier contact
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

        <TabsContent value="supplier-names" className="mt-0 focus-visible:outline-none">
          <InventoryNamedListPage
            title="Supplier names"
            description="Supplier name dropdown on Add/Edit product"
            emptyHint="No supplier names yet — add one, then select it on products"
            items={supplierNames.items}
            loading={supplierNames.loading}
            addItem={supplierNames.addItem}
            renameItem={supplierNames.renameItem}
            deleteItem={supplierNames.deleteItem}
            embedded
          />
        </TabsContent>

        <TabsContent value="supplier-contacts" className="mt-0 focus-visible:outline-none">
          <InventoryNamedListPage
            title="Supplier contacts"
            description="Supplier contact dropdown on Add/Edit product (phone, etc.)"
            emptyHint="No supplier contacts yet — add one, then select it on products"
            items={supplierContacts.items}
            loading={supplierContacts.loading}
            addItem={supplierContacts.addItem}
            renameItem={supplierContacts.renameItem}
            deleteItem={supplierContacts.deleteItem}
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
