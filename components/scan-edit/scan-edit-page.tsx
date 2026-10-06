"use client"

import { useCallback, useMemo, useState } from "react"
import Link from "next/link"
import { ScanBarcode, Package, Send } from "lucide-react"
import { toast } from "sonner"
import { useProductScanLookup } from "@/hooks/use-firestore"
import { useDropdownRegistryNames } from "@/hooks/use-dropdown-registry-names"
import { submitOpenDraftEntry } from "@/lib/features/inventory/services/open_draft_entry_service"
import { db } from "@/lib/firebase"
import { isRestrictedStaff, useSessionUser } from "@/lib/auth-session"
import { BarcodeScannerInput } from "@/components/inventory/barcode-scanner-input"
import { InventoryFieldSelect } from "@/components/inventory/inventory-field-select"
import { isRegisteredDropdownValue } from "@/lib/inventory/dropdown-registry"
import { isRegisteredSupplierName } from "@/lib/inventory/supplier-registry"
import { useSupplierRegistrySnapshot } from "@/hooks/use-supplier-registry-snapshot"
import { RACK_OPTIONS } from "@/lib/rack-options"
import { STATUS_OPTIONS, STATUS_OPTIONS_SET } from "@/lib/status-options"
import type { Product } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"

const labelClass = "text-sm font-medium text-foreground"
const inputClass = "h-11 rounded-lg border-border/80 shadow-sm"
const fieldGroup = "space-y-2"
const readOnlyClass =
  "flex h-11 items-center rounded-lg border border-dashed border-border/80 bg-muted/40 px-3 text-sm"

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(amount)
}

export function ScanEditPage() {
  const { user } = useSessionUser()
  const lookupProduct = useProductScanLookup()
  const isFieldStaff = user ? isRestrictedStaff(user) : false
  const { names: brandOptions } = useDropdownRegistryNames("product_brands")
  const { names: categoryOptions } = useDropdownRegistryNames("product_categories")
  const { names: supplierNameOptions, contactForName } = useSupplierRegistrySnapshot()

  const accountTag = user?.accountTag ?? user?.name ?? "STAFF"

  const [barcode, setBarcode] = useState("")
  const [loadingProduct, setLoadingProduct] = useState(false)
  const [product, setProduct] = useState<Product | null>(null)
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({
    name: "",
    brand: "",
    rack: "",
    status: "active",
    category: "",
    supplierName: "",
    supplierContact: "",
  })

  const categoryChoices = useMemo(() => {
    const names = [...categoryOptions]
    const current = form.category.trim()
    if (current && !names.some((n) => n.toLowerCase() === current.toLowerCase())) {
      names.unshift(current)
    }
    return names
  }, [categoryOptions, form.category])

  const resetForm = useCallback(() => {
    setProduct(null)
    setForm({
      name: "",
      brand: "",
      rack: "",
      status: "active",
      category: "",
      supplierName: "",
      supplierContact: "",
    })
  }, [])

  const loadProduct = async (code: string) => {
    const trimmed = code.trim()
    if (!trimmed) return
    setLoadingProduct(true)
    try {
      const found = await lookupProduct(trimmed)
      if (!found) {
        resetForm()
        setBarcode(trimmed)
        toast.error("No product found for this barcode or ID")
        return
      }
      setProduct(found)
      setBarcode(trimmed)
      setForm({
        name: found.name || "",
        brand: found.brand || "",
        rack: found.rack || "",
        status:
          found.status && STATUS_OPTIONS_SET.has(found.status as (typeof STATUS_OPTIONS)[number])
            ? found.status
            : "active",
        category: found.category || "",
        supplierName: found.supplierName || "",
        supplierContact: found.supplierContact || "",
      })
      toast.success(`Loaded: ${found.name}`)
    } catch (err) {
      console.error(err)
      toast.error(err instanceof Error ? err.message : "Lookup failed")
    } finally {
      setLoadingProduct(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!product?.id) {
      toast.error("Scan a product first")
      return
    }
    if (!form.name.trim()) {
      toast.error("Name is required")
      return
    }
    if (!form.category.trim()) {
      toast.error("Select a category")
      return
    }
    if (!isRegisteredDropdownValue(form.brand, brandOptions)) {
      toast.error("Select a brand from the list (or leave empty)")
      return
    }
    if (!isFieldStaff) {
      if (!isRegisteredSupplierName(form.supplierName, supplierNameOptions)) {
        toast.error("Select a supplier from Manage Dropdown (or leave empty)")
        return
      }
    }
    if (
      !form.status ||
      !STATUS_OPTIONS_SET.has(form.status as (typeof STATUS_OPTIONS)[number])
    ) {
      toast.error("Select status")
      return
    }

    setSaving(true)
    try {
      await submitOpenDraftEntry(db, {
        productId: product.id,
        barcode: product.barcode || barcode,
        name: form.name.trim(),
        category: form.category.trim(),
        rack: form.rack.trim(),
        tag: accountTag,
        status: form.status,
        brand: form.brand.trim() || undefined,
        supplierName: isFieldStaff
          ? product.supplierName?.trim() || undefined
          : form.supplierName.trim() || undefined,
        supplierContact: isFieldStaff
          ? product.supplierContact?.trim() || undefined
          : form.supplierName.trim()
            ? contactForName(form.supplierName.trim()) || undefined
            : undefined,
        mrp: product.mrp,
        discountPercent: product.discountPercent,
        price: product.price,
        stock: product.stock,
        editedBy: accountTag,
        editedByEmail: user?.email ?? "",
      })
      toast.success("Saved to Open Draft Entries for review")
      setBarcode("")
      resetForm()
    } catch (err) {
      console.error(err)
      toast.error(err instanceof Error ? err.message : "Failed to save")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <ScanBarcode className="h-7 w-7 text-primary" />
            Scan &amp; Edit
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Scan an item, update basic details, and send changes for admin approval. Pricing fields
            stay read-only.
          </p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href="/open-draft-entries">Open Draft Entries</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Find product</CardTitle>
          <CardDescription>
            Tap Camera to scan on mobile, use a scanner gun, or type barcode / product ID — then
            Find
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <BarcodeScannerInput
            id="scan-edit-barcode"
            value={barcode}
            onChange={setBarcode}
            onCommit={(code) => void loadProduct(code)}
            placeholder="Barcode or product ID…"
            className={inputClass}
            disabled={loadingProduct}
          />
          <Button
            type="button"
            disabled={loadingProduct || !barcode.trim()}
            onClick={() => void loadProduct(barcode)}
          >
            {loadingProduct ? "Looking up…" : "Find product"}
          </Button>
        </CardContent>
      </Card>

      {product && (
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Package className="h-5 w-5" />
                {product.name}
              </CardTitle>
              <CardDescription>
                Tag on save: <span className="font-mono font-semibold text-foreground">{accountTag}</span>{" "}
                (tracks who edited)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                  Read-only
                </p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className={fieldGroup}>
                    <Label className={labelClass}>Barcode</Label>
                    <div className={cn(readOnlyClass, "font-mono")}>{product.barcode || "—"}</div>
                  </div>
                  <div className={fieldGroup}>
                    <Label className={labelClass}>Stock</Label>
                    <div className={readOnlyClass}>{product.stock}</div>
                  </div>
                  <div className={fieldGroup}>
                    <Label className={labelClass}>MRP</Label>
                    <div className={readOnlyClass}>
                      {product.mrp != null && product.mrp > 0
                        ? formatCurrency(product.mrp)
                        : "—"}
                    </div>
                  </div>
                  <div className={fieldGroup}>
                    <Label className={labelClass}>Discount %</Label>
                    <div className={readOnlyClass}>
                      {product.discountPercent != null ? `${product.discountPercent}%` : "—"}
                    </div>
                  </div>
                  <div className={fieldGroup}>
                    <Label className={labelClass}>Selling price</Label>
                    <div className={readOnlyClass}>{formatCurrency(product.price)}</div>
                  </div>
                </div>
              </div>

              <Separator />

              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                  Editable
                </p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className={cn(fieldGroup, "sm:col-span-2")}>
                    <Label htmlFor="name" className={labelClass}>
                      Name *
                    </Label>
                    <Input
                      id="name"
                      className={inputClass}
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                    />
                  </div>
                  <div className={fieldGroup}>
                    <Label className={labelClass}>Category *</Label>
                    <Select
                      value={form.category || undefined}
                      onValueChange={(category) => setForm({ ...form, category })}
                    >
                      <SelectTrigger className={inputClass}>
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        {categoryChoices.map((name) => (
                          <SelectItem key={name} value={name}>
                            {name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className={fieldGroup}>
                    <Label className={labelClass}>Brand</Label>
                    <InventoryFieldSelect
                      value={form.brand}
                      onChange={(brand) => setForm({ ...form, brand })}
                      options={brandOptions}
                      placeholder="Select brand"
                      triggerClassName={inputClass}
                    />
                  </div>
                  <div className={fieldGroup}>
                    <Label className={labelClass}>Rack</Label>
                    <Select
                      value={form.rack || undefined}
                      onValueChange={(rack) => setForm({ ...form, rack })}
                    >
                      <SelectTrigger className={inputClass}>
                        <SelectValue placeholder="Optional" />
                      </SelectTrigger>
                      <SelectContent>
                        {RACK_OPTIONS.map((opt) => (
                          <SelectItem key={opt} value={opt}>
                            {opt}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className={fieldGroup}>
                    <Label className={labelClass}>Status</Label>
                    <Select
                      value={form.status}
                      onValueChange={(status) => setForm({ ...form, status })}
                    >
                      <SelectTrigger className={inputClass}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTIONS.map((opt) => (
                          <SelectItem key={opt} value={opt}>
                            {opt}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {!isFieldStaff && (
                    <>
                      <div className={fieldGroup}>
                        <Label className={labelClass}>Supplier name</Label>
                        <InventoryFieldSelect
                          value={form.supplierName}
                          onChange={(supplierName) =>
                            setForm({
                              ...form,
                              supplierName,
                              supplierContact: contactForName(supplierName),
                            })
                          }
                          options={supplierNameOptions}
                          placeholder="Select supplier"
                          triggerClassName={inputClass}
                        />
                      </div>
                      <div className={fieldGroup}>
                        <Label className={labelClass}>Supplier contact (auto)</Label>
                        <Input
                          readOnly
                          tabIndex={-1}
                          value={form.supplierContact}
                          placeholder="Select supplier above"
                          className={cn(inputClass, "bg-muted/40 text-muted-foreground")}
                        />
                      </div>
                    </>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex flex-wrap gap-3">
            <Button type="submit" disabled={saving} className="gap-2">
              <Send className="h-4 w-4" />
              {saving ? "Submitting…" : "Submit for review"}
            </Button>
            <Button type="button" variant="outline" onClick={resetForm}>
              Clear
            </Button>
          </div>
        </form>
      )}
    </div>
  )
}
