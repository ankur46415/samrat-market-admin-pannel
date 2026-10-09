"use client"

import { use, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, FilePenLine } from "lucide-react"
import { doc, getDoc } from "firebase/firestore"
import { toast } from "sonner"
import {
  useCategories,
  useDraftProducts,
  useProductBrands,
  useProductTags,
} from "@/hooks/use-firestore"
import { useSupplierRegistrySnapshot } from "@/hooks/use-supplier-registry-snapshot"
import { InventoryFieldSelect } from "@/components/inventory/inventory-field-select"
import { OrderPicker, orderRefOf, type OrderRef } from "@/components/inventory/order-picker"
import { db } from "@/lib/firebase"
import { col } from "@/lib/account-mode"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Separator } from "@/components/ui/separator"
import { normalizeProductUnit, parseMinStockInput } from "@/lib/stock"
import { discountedUnitPrice, parseDiscountInput } from "@/lib/billing/line-discount"
import { RACK_OPTIONS } from "@/lib/rack-options"
import { STATUS_OPTIONS, STATUS_OPTIONS_SET } from "@/lib/status-options"
import { cn } from "@/lib/utils"
import { isRegisteredDropdownValue } from "@/lib/inventory/dropdown-registry"
import { isRegisteredSupplierName } from "@/lib/inventory/supplier-registry"
import { GstPercentSelect } from "@/components/inventory/gst-percent-select"
import { priceWithGst } from "@/lib/inventory/gst-percent"
import { isRestrictedStaff, useSessionUser } from "@/lib/auth-session"
import { draftOwnedBySessionAccount } from "@/lib/draft-account"

const labelClass = "text-sm font-medium text-foreground"
const inputClass = "h-11 rounded-lg border-border/80 shadow-sm"
const fieldGroup = "space-y-2"

function sellingPriceFromMrp(mrp: string, discountPercent: string): string | null {
  const m = parseFloat(mrp)
  if (!Number.isFinite(m) || m <= 0) return null
  const d = parseDiscountInput(discountPercent) ?? 0
  return String(discountedUnitPrice(m, d))
}

function statusLabel(value: string) {
  return value === "deactive" ? "Inactive" : "Active"
}

export default function EditDraftEntryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const { user } = useSessionUser()
  const isStaffAccount = user ? isRestrictedStaff(user) : false
  const { drafts, loading, updateDraft } = useDraftProducts()
  const { categories } = useCategories()
  const { names: brandOptions } = useProductBrands()
  const { names: tagOptions } = useProductTags()
  const { names: supplierNameOptions, contactForName } = useSupplierRegistrySnapshot()
  const [saving, setSaving] = useState(false)
  const [showNewCategory, setShowNewCategory] = useState(false)
  const [newCategory, setNewCategory] = useState("")
  const [formReady, setFormReady] = useState(false)

  const draft = drafts.find((d) => d.id === id)

  useEffect(() => {
    if (loading || !draft || !isStaffAccount) return
    if (!draftOwnedBySessionAccount(draft, user?.accountTag)) {
      toast.error("You can only edit drafts from your account")
      router.replace("/draft-entries")
    }
  }, [loading, draft, isStaffAccount, user?.accountTag, router])

  const [formData, setFormData] = useState({
    name: "",
    category: "",
    rack: "",
    tag: "",
    status: "deactive",
    mrp: "",
    discountPercent: "",
    price: "",
    costPrice: "",
    stock: "",
    unit: "pcs",
    barcode: "",
    brand: "",
    supplierName: "",
    supplierContact: "",
    expiry: "",
    noExpiry: false,
    minStock: "10",
    gstPercent: undefined as number | undefined,
  })
  const [order, setOrder] = useState<OrderRef>({})

  useEffect(() => {
    if (!draft) return
    void (async () => {
      let noExpiry = false
      try {
        const snap = await getDoc(doc(db, col("draft_products"), id))
        if (snap.exists()) {
          noExpiry = snap.data()?.noExpiry === true
        }
      } catch {
        /* ignore */
      }

      const mrpStr = draft.mrp != null && draft.mrp > 0 ? String(draft.mrp) : ""
      setFormData({
        name: draft.name || "",
        category: draft.category || "",
        rack: draft.rack || "",
        tag: draft.tag || "",
        status:
          draft.status && STATUS_OPTIONS_SET.has(draft.status as (typeof STATUS_OPTIONS)[number])
            ? draft.status
            : "deactive",
        mrp: mrpStr,
        discountPercent:
          draft.discountPercent != null && draft.discountPercent > 0
            ? String(draft.discountPercent)
            : "",
        price: draft.price?.toString() || "0",
        costPrice: draft.costPrice?.toString() || "0",
        stock: String(draft.stock ?? 0),
        unit: draft.unit || "pcs",
        barcode: draft.barcode || "",
        brand: draft.brand || "",
        supplierName: draft.supplierName || "",
        supplierContact: draft.supplierName
          ? contactForName(draft.supplierName) || draft.supplierContact || ""
          : "",
        expiry: draft.expiry || "",
        noExpiry,
        minStock: String(draft.minStock ?? 10),
        gstPercent: draft.gstPercent,
      })
      setOrder(orderRefOf(draft))
      setFormReady(true)
    })()
  }, [draft, id, contactForName])

  const handleMrpChange = (mrp: string) => {
    setFormData((prev) => {
      const next = { ...prev, mrp }
      const autoPrice = sellingPriceFromMrp(mrp, prev.discountPercent)
      if (autoPrice != null) next.price = autoPrice
      return next
    })
  }

  const handleDiscountChange = (discountPercent: string) => {
    setFormData((prev) => {
      const next = { ...prev, discountPercent }
      const autoPrice = sellingPriceFromMrp(prev.mrp, discountPercent)
      if (autoPrice != null) next.price = autoPrice
      return next
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.barcode.trim()) {
      toast.error("Barcode is required")
      return
    }
    if (!formData.status || !STATUS_OPTIONS_SET.has(formData.status as (typeof STATUS_OPTIONS)[number])) {
      toast.error("Select status")
      return
    }

    const category = showNewCategory ? newCategory.trim() : formData.category.trim()
    if (!category) {
      toast.error("Select or enter a category")
      return
    }
    if (!isRegisteredDropdownValue(formData.brand, brandOptions)) {
      toast.error("Select a brand from Manage Dropdown (or leave empty)")
      return
    }
    if (!isRegisteredDropdownValue(formData.tag, tagOptions)) {
      toast.error("Select a tag from Manage Dropdown (or leave empty)")
      return
    }
    if (!isRegisteredSupplierName(formData.supplierName, supplierNameOptions)) {
      toast.error("Select a supplier from Manage Dropdown → Suppliers (or leave empty)")
      return
    }

    const stockNum = parseInt(formData.stock, 10)
    if (formData.expiry && !formData.noExpiry && (!Number.isFinite(stockNum) || stockNum <= 0)) {
      toast.error("Quantity must be greater than 0 when expiry is set")
      return
    }
    if (
      Number.isFinite(stockNum) &&
      stockNum > 0 &&
      !formData.expiry &&
      !formData.noExpiry
    ) {
      toast.error("Select expiry or tick No expiry when quantity is set")
      return
    }

    setSaving(true)
    try {
      await updateDraft(id, {
        name: formData.name || "Unnamed Product",
        category,
        rack: formData.rack,
        tag: formData.tag,
        status: formData.status,
        price: parseFloat(formData.price),
        costPrice: formData.costPrice.trim() ? parseFloat(formData.costPrice) : 0,
        mrp: formData.mrp.trim() ? parseFloat(formData.mrp) : undefined,
        discountPercent: parseDiscountInput(formData.discountPercent) || undefined,
        stock: Number.isFinite(stockNum) && stockNum > 0 ? stockNum : 0,
        unit: normalizeProductUnit(formData.unit),
        barcode: formData.barcode,
        brand: formData.brand || undefined,
        supplierName: formData.supplierName || undefined,
        supplierContact: formData.supplierName
          ? contactForName(formData.supplierName) || undefined
          : undefined,
        expiry: formData.noExpiry ? undefined : formData.expiry || undefined,
        noExpiry: formData.noExpiry || undefined,
        minStock: parseMinStockInput(formData.minStock, 10),
        gstPercent: formData.gstPercent,
        ...order,
      })
      toast.success("Draft entry updated")
      router.push("/draft-entries")
    } catch (error) {
      console.error(error)
      toast.error(error instanceof Error ? error.message : "Failed to update draft")
    } finally {
      setSaving(false)
    }
  }

  if (loading || (draft && !formReady)) {
    return (
      <div className="mx-auto max-w-3xl space-y-6 pb-10">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-[520px] rounded-xl" />
      </div>
    )
  }

  if (!draft) {
    return (
      <div className="mx-auto flex max-w-lg flex-col items-center gap-4 py-20 text-center">
        <p className="text-muted-foreground">Draft entry not found</p>
        <Button asChild variant="outline">
          <Link href="/draft-entries">Back to Draft Entries</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8 pb-12">
      <div className="flex items-start gap-4">
        <Button variant="ghost" size="icon" className="mt-0.5 shrink-0 rounded-lg" asChild>
          <Link href="/draft-entries">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="min-w-0 space-y-1">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-primary">
            <FilePenLine className="h-4 w-4" />
            Draft Entries
          </p>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Edit draft</h1>
          <p className="font-mono text-sm text-muted-foreground">{draft.barcode}</p>
        </div>
      </div>

      <form onSubmit={(e) => void handleSubmit(e)}>
        <Card className="border-border/80 shadow-sm">
          <CardHeader>
            <CardTitle>Product details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-6 sm:grid-cols-2">
              <div className={cn(fieldGroup, "sm:col-span-2")}>
                <Label className={labelClass}>Name</Label>
                <Input
                  className={inputClass}
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div className={fieldGroup}>
                <Label className={labelClass}>Barcode *</Label>
                <Input
                  className={cn(inputClass, "font-mono")}
                  value={formData.barcode}
                  onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                />
              </div>
              <div className={fieldGroup}>
                <Label className={labelClass}>Brand</Label>
                <InventoryFieldSelect
                  value={formData.brand}
                  onChange={(brand) => setFormData({ ...formData, brand })}
                  options={brandOptions}
                  placeholder="Select brand"
                  triggerClassName={inputClass}
                />
              </div>
              <div className={fieldGroup}>
                <Label className={labelClass}>Supplier name</Label>
                <InventoryFieldSelect
                  value={formData.supplierName}
                  onChange={(supplierName) =>
                    setFormData({
                      ...formData,
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
                  className={cn(inputClass, "bg-muted/40 text-muted-foreground")}
                  placeholder="Select supplier name above"
                  value={formData.supplierContact}
                />
              </div>
              <div className={fieldGroup}>
                <Label className={labelClass}>Category *</Label>
                {showNewCategory ? (
                  <Input
                    className={inputClass}
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    placeholder="New category"
                  />
                ) : (
                  <Select
                    value={formData.category}
                    onValueChange={(value) => {
                      if (value === "new") setShowNewCategory(true)
                      else setFormData({ ...formData, category: value })
                    }}
                  >
                    <SelectTrigger className={inputClass}>
                      <SelectValue placeholder="Category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories
                        .map((c) => (c.name ?? "").trim())
                        .filter(Boolean)
                        .map((name) => (
                          <SelectItem key={name} value={name}>
                            {name}
                          </SelectItem>
                        ))}
                      <SelectItem value="new">+ New category</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>
              <div className={fieldGroup}>
                <Label className={labelClass}>Rack</Label>
                <Select
                  value={formData.rack || undefined}
                  onValueChange={(value) => setFormData({ ...formData, rack: value })}
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
                <Label className={labelClass}>Tag</Label>
                <InventoryFieldSelect
                  value={formData.tag}
                  onChange={(tag) => setFormData({ ...formData, tag })}
                  options={tagOptions}
                  placeholder="Select tag"
                  triggerClassName={inputClass}
                />
              </div>
              <OrderPicker
                className="sm:col-span-2"
                value={order}
                onChange={setOrder}
                fieldClassName={fieldGroup}
                labelClassName={labelClass}
                triggerClassName={inputClass}
              />
              <div className={fieldGroup}>
                <Label className={labelClass}>Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) => setFormData({ ...formData, status: value })}
                >
                  <SelectTrigger className={inputClass}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((opt) => (
                      <SelectItem key={opt} value={opt}>
                        {statusLabel(opt)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className={fieldGroup}>
                <Label className={labelClass}>Unit</Label>
                <Select
                  value={formData.unit}
                  onValueChange={(value) => setFormData({ ...formData, unit: value })}
                >
                  <SelectTrigger className={inputClass}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pcs">pcs</SelectItem>
                    <SelectItem value="kg">kg</SelectItem>
                    <SelectItem value="pack">pack</SelectItem>
                    <SelectItem value="box">box</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className={fieldGroup}>
                <Label className={labelClass}>Min stock alert</Label>
                <Input
                  type="number"
                  min={0}
                  className={inputClass}
                  value={formData.minStock}
                  onChange={(e) => setFormData({ ...formData, minStock: e.target.value })}
                />
              </div>
            </div>

            <Separator />

            <div className="grid gap-6 sm:grid-cols-2">
              <div className={fieldGroup}>
                <Label className={labelClass}>MRP</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  className={inputClass}
                  value={formData.mrp}
                  onChange={(e) => handleMrpChange(e.target.value)}
                />
              </div>
              <div className={fieldGroup}>
                <Label className={labelClass}>Discount %</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  className={inputClass}
                  value={formData.discountPercent}
                  onChange={(e) => handleDiscountChange(e.target.value)}
                />
              </div>
              <div className={fieldGroup}>
                <Label className={labelClass}>Selling price *</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  className={inputClass}
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  required
                />
              </div>
              <div className={fieldGroup}>
                <Label className={labelClass}>Cost price</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  className={inputClass}
                  value={formData.costPrice}
                  onChange={(e) => setFormData({ ...formData, costPrice: e.target.value })}
                />
              </div>
              <div className={fieldGroup}>
                <Label className={labelClass}>GST %</Label>
                <GstPercentSelect
                  value={formData.gstPercent}
                  onChange={(gstPercent) => setFormData((prev) => ({ ...prev, gstPercent }))}
                />
                {formData.gstPercent != null && parseFloat(formData.price) > 0 ? (
                  <p className="text-xs text-muted-foreground tabular-nums">
                    Selling price + GST: ₹
                    {priceWithGst(parseFloat(formData.price), formData.gstPercent).toLocaleString(
                      "en-IN",
                      { maximumFractionDigits: 2 }
                    )}
                  </p>
                ) : null}
              </div>
            </div>

            <Separator />

            <div className="grid gap-6 sm:grid-cols-2">
              <div className={fieldGroup}>
                <Label className={labelClass}>Quantity</Label>
                <Input
                  type="number"
                  min={0}
                  className={inputClass}
                  value={formData.stock}
                  onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                />
              </div>
              <div className={fieldGroup}>
                <Label className={labelClass}>Expiry date</Label>
                <Input
                  type="date"
                  className={inputClass}
                  disabled={formData.noExpiry}
                  value={formData.expiry}
                  onChange={(e) => setFormData({ ...formData, expiry: e.target.value })}
                />
              </div>
              <div className="flex items-center gap-2 sm:col-span-2">
                <Checkbox
                  id="draft-no-expiry"
                  checked={formData.noExpiry}
                  onCheckedChange={(checked) =>
                    setFormData({
                      ...formData,
                      noExpiry: checked === true,
                      expiry: checked === true ? "" : formData.expiry,
                    })
                  }
                />
                <Label htmlFor="draft-no-expiry" className="font-normal">
                  No expiry
                </Label>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" asChild>
                <Link href="/draft-entries">Cancel</Link>
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving…" : "Save draft"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  )
}
