"use client"

import { Suspense, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { ListTree } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { InventoryNamedListPage } from "@/components/inventory/inventory-named-list-page"
import { useProductBrands, useProductTags } from "@/hooks/use-firestore"

const BASE_PATH = "/manage-dropdown"

type DropdownTab = "brands" | "tags"

function ManageDropdownContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const paramTab = searchParams.get("tab")
  const initialTab: DropdownTab = paramTab === "tags" ? "tags" : "brands"
  const [tab, setTab] = useState<DropdownTab>(initialTab)

  const brands = useProductBrands()
  const tags = useProductTags()

  useEffect(() => {
    const next: DropdownTab = paramTab === "tags" ? "tags" : "brands"
    setTab(next)
  }, [paramTab])

  const onTabChange = (value: string) => {
    const next = value === "tags" ? "tags" : "brands"
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
          Only values you add here appear in product Brand and Tag dropdowns. Old free-typed values
          on products are not listed — pick from this registry or leave empty.
        </p>
      </div>

      <Tabs value={tab} onValueChange={onTabChange} className="w-full">
        <TabsList className="mb-6 grid h-auto w-full max-w-md grid-cols-2 gap-1 rounded-xl bg-muted/60 p-1.5">
          <TabsTrigger
            value="brands"
            className="rounded-lg py-2.5 data-[state=active]:bg-background data-[state=active]:shadow-sm"
          >
            Brand
          </TabsTrigger>
          <TabsTrigger
            value="tags"
            className="rounded-lg py-2.5 data-[state=active]:bg-background data-[state=active]:shadow-sm"
          >
            Tag
          </TabsTrigger>
        </TabsList>

        <TabsContent value="brands" className="mt-0 focus-visible:outline-none">
          <InventoryNamedListPage
            title="Brands"
            description="Values shown in the Brand dropdown when adding or editing a product"
            emptyHint="No brands yet — add one, then select it on Add/Edit product"
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
            description="Values shown in the Tag dropdown when adding or editing a product"
            emptyHint="No tags yet — add one, then select it on Add/Edit product"
            items={tags.items}
            loading={tags.loading}
            addItem={tags.addItem}
            renameItem={tags.renameItem}
            deleteItem={tags.deleteItem}
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
