"use client"

import { useEffect, useMemo, useState } from "react"
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { BarChart3, IndianRupee, Package } from "lucide-react"
import type { GstPurchaseCatalog } from "@/lib/features/gst-purchase-catalog/models"
import {
  ALL_GST_FILTER,
  ALL_ORDER_TAGS,
  defaultCatalogOrderTag,
  gstFilterLabel,
  purchaseTotalsByCatalogGroup,
  uniqueCatalogGstFilters,
  uniqueCatalogOrderTags,
} from "@/lib/features/gst-purchase-catalog/models"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

function formatInr(n: number): string {
  return `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`
}

function formatAxisInr(n: number): string {
  if (n >= 10_000_000) return `₹${(n / 10_000_000).toFixed(1)}Cr`
  if (n >= 100_000) return `₹${(n / 100_000).toFixed(1)}L`
  if (n >= 1000) return `₹${(n / 1000).toFixed(1)}k`
  return `₹${n}`
}

export function GstOrderTagPurchaseChart({ catalogs }: { catalogs: GstPurchaseCatalog[] }) {
  const tags = useMemo(() => uniqueCatalogOrderTags(catalogs), [catalogs])
  const [selectedTag, setSelectedTag] = useState(() => defaultCatalogOrderTag(tags) || ALL_ORDER_TAGS)
  const [selectedGst, setSelectedGst] = useState(ALL_GST_FILTER)

  useEffect(() => {
    if (selectedTag === ALL_ORDER_TAGS) return
    if (tags.includes(selectedTag)) return
    setSelectedTag(defaultCatalogOrderTag(tags) || ALL_ORDER_TAGS)
  }, [tags, selectedTag])

  const gstOptions = useMemo(
    () => uniqueCatalogGstFilters(catalogs, selectedTag),
    [catalogs, selectedTag]
  )

  useEffect(() => {
    if (selectedGst === ALL_GST_FILTER) return
    if (gstOptions.includes(selectedGst)) return
    setSelectedGst(ALL_GST_FILTER)
  }, [gstOptions, selectedGst])

  const rows = useMemo(
    () => purchaseTotalsByCatalogGroup(catalogs, selectedTag, selectedGst),
    [catalogs, selectedTag, selectedGst]
  )
  const grandTotal = useMemo(
    () => rows.reduce((sum, row) => sum + row.total, 0),
    [rows]
  )
  const itemCount = useMemo(
    () => rows.reduce((sum, row) => sum + row.items, 0),
    [rows]
  )

  if (catalogs.length === 0) return null

  const tagLabel = selectedTag === ALL_ORDER_TAGS ? "all order tags" : selectedTag
  const gstLabelText = gstFilterLabel(selectedGst)
  const filterLabel = `${tagLabel} · ${gstLabelText}`

  return (
    <Card className="border-teal-100 shadow-md">
      <CardHeader className="gap-4 sm:flex-row sm:items-start sm:justify-between space-y-0">
        <div className="min-w-0 space-y-1">
          <CardTitle className="flex items-center gap-2 text-lg">
            <BarChart3 className="h-5 w-5 text-teal-600" />
            Purchase by catalog group
          </CardTitle>
          <CardDescription>
            Total purchase is price × MOQ (GST not included). Filter by order tag and GST %.
          </CardDescription>
        </div>
        <div className="flex w-full shrink-0 flex-col gap-3 sm:w-auto sm:flex-row">
          <div className="w-full space-y-1.5 sm:w-[200px]">
            <Label htmlFor="gst-order-tag-chart" className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Order tag
            </Label>
            <Select value={selectedTag} onValueChange={setSelectedTag}>
              <SelectTrigger id="gst-order-tag-chart" className="bg-white">
                <SelectValue placeholder="Select order tag" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_ORDER_TAGS}>All order tags</SelectItem>
                {tags.map((tag) => (
                  <SelectItem key={tag} value={tag}>
                    {tag}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-full space-y-1.5 sm:w-[160px]">
            <Label htmlFor="gst-percent-chart" className="text-xs font-bold uppercase tracking-wider text-slate-500">
              GST %
            </Label>
            <Select value={selectedGst} onValueChange={setSelectedGst}>
              <SelectTrigger id="gst-percent-chart" className="bg-white">
                <SelectValue placeholder="Select GST" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_GST_FILTER}>All GST</SelectItem>
                {gstOptions.map((gst) => (
                  <SelectItem key={gst} value={gst}>
                    {gstFilterLabel(gst)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-teal-100 bg-teal-50/60 px-4 py-3">
            <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-teal-700">
              <IndianRupee className="h-3.5 w-3.5" />
              Total purchase
            </p>
            <p className="mt-1 text-2xl font-black tabular-nums text-teal-900">{formatInr(grandTotal)}</p>
            <p className="text-xs text-teal-700/80">{filterLabel}</p>
          </div>
          <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
            <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
              <Package className="h-3.5 w-3.5" />
              Catalog groups
            </p>
            <p className="mt-1 text-2xl font-black tabular-nums text-slate-800">{rows.length}</p>
            <p className="text-xs text-slate-500">{itemCount} product{itemCount === 1 ? "" : "s"}</p>
          </div>
        </div>

        {rows.length === 0 ? (
          <div className="flex h-[240px] items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/60 text-sm text-slate-400">
            No purchase for {filterLabel}.
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-5">
            <div className="h-[300px] lg:col-span-3">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={rows} margin={{ top: 8, right: 8, left: 4, bottom: 48 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                  <XAxis
                    dataKey="name"
                    interval={0}
                    angle={-28}
                    textAnchor="end"
                    height={70}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    width={64}
                    tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                    tickFormatter={formatAxisInr}
                  />
                  <Tooltip
                    cursor={{ fill: "rgba(15, 118, 110, 0.06)" }}
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null
                      const row = payload[0].payload as (typeof rows)[number]
                      return (
                        <div className="rounded-lg border bg-white p-3 shadow-lg">
                          <p className="text-sm font-semibold text-slate-800">{row.name}</p>
                          <p className="text-lg font-black text-teal-800">{formatInr(row.total)}</p>
                          <p className="text-xs text-slate-500">
                            {row.items} product{row.items === 1 ? "" : "s"} · {filterLabel}
                          </p>
                        </div>
                      )
                    }}
                  />
                  <Bar dataKey="total" radius={[6, 6, 0, 0]} maxBarSize={56}>
                    {rows.map((row) => (
                      <Cell key={row.id} fill={row.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="max-h-[300px] overflow-y-auto rounded-xl border border-slate-100 lg:col-span-2">
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 bg-slate-50">
                  <tr className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    <th className="px-3 py-2">Catalog group</th>
                    <th className="px-3 py-2 text-right">Purchase</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id} className="border-t border-slate-100">
                      <td className="px-3 py-2">
                        <span className="flex items-center gap-2 font-medium text-slate-800">
                          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: row.color }} />
                          <span className="truncate">{row.name}</span>
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right font-bold tabular-nums text-slate-900">
                        {formatInr(row.total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
