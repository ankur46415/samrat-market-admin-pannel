"use client"

import { useEffect, useMemo, useState } from "react"
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { BarChart3, Download, IndianRupee, Loader2, Package, Percent } from "lucide-react"
import type { GstPurchaseCatalog, GstSaleRecordPercents } from "@/lib/features/gst-purchase-catalog/models"
import {
  ALL_GST_FILTER,
  ALL_ORDER_TAGS,
  DEFAULT_GST_PERCENTS,
  defaultCatalogOrderTag,
  gstFilterLabel,
  gstWiseReportData,
  purchaseTotalsByCatalogGroup,
  saleAmountFromMrp,
  uniqueCatalogGstFilters,
  uniqueCatalogOrderTags,
} from "@/lib/features/gst-purchase-catalog/models"
import { downloadGstSaleRecordReport, downloadGstWiseSaleReport, downloadGstWiseSummaryReport } from "@/lib/features/gst-purchase-catalog/pdf-export"
import { chartFillAt } from "@/lib/chart-colors"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
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

export function GstOrderTagPurchaseChart({
  catalogs,
  gstPercents = DEFAULT_GST_PERCENTS,
  saleRecordPercents = {},
  onSaveSaleRecordPercents,
  onSelectedTagChange,
}: {
  catalogs: GstPurchaseCatalog[]
  gstPercents?: number[]
  saleRecordPercents?: GstSaleRecordPercents
  onSaveSaleRecordPercents?: (next: GstSaleRecordPercents) => Promise<void>
  onSelectedTagChange?: (tag: string) => void
}) {
  const tags = useMemo(() => uniqueCatalogOrderTags(catalogs), [catalogs])
  const [selectedTag, setSelectedTag] = useState(() => defaultCatalogOrderTag(tags) || ALL_ORDER_TAGS)
  const [selectedGst, setSelectedGst] = useState(ALL_GST_FILTER)
  const [exporting, setExporting] = useState<"summary" | "full" | "record" | null>(null)
  const [salePercentDrafts, setSalePercentDrafts] = useState<Record<string, string>>({})

  useEffect(() => {
    onSelectedTagChange?.(selectedTag)
  }, [selectedTag, onSelectedTagChange])

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

  const showGstWise = selectedGst === ALL_GST_FILTER

  const groupRows = useMemo(
    () => purchaseTotalsByCatalogGroup(catalogs, selectedTag, selectedGst),
    [catalogs, selectedTag, selectedGst]
  )
  const gstReport = useMemo(
    () => gstWiseReportData(catalogs, selectedTag, gstPercents),
    [catalogs, selectedTag, gstPercents]
  )
  const gstRows = gstReport.slabs

  const rows = showGstWise ? gstRows : groupRows
  const grandTotal = useMemo(
    () => (showGstWise
      ? gstRows.reduce((sum, row) => sum + row.taxable, 0)
      : groupRows.reduce((sum, row) => sum + row.total, 0)),
    [showGstWise, gstRows, groupRows]
  )
  const gstAmountTotal = useMemo(
    () => gstRows.reduce((sum, row) => sum + row.gstAmount, 0),
    [gstRows]
  )
  const saleTotal = useMemo(
    () => gstRows.reduce((sum, row) => sum + row.saleValue, 0),
    [gstRows]
  )
  const saleRecordRows = useMemo(() => {
    const tagPercents = saleRecordPercents[selectedTag] ?? {}
    return gstRows.map((row) => {
      const drafted = Number(salePercentDrafts[row.gstKey])
      const salePercent = Number.isFinite(drafted) && drafted > 0
        ? drafted
        : Number(tagPercents[row.gstKey]) || 0
      return {
        ...row,
        salePercent,
        saleAmount: saleAmountFromMrp(row.taxable, salePercent),
      }
    })
  }, [gstRows, saleRecordPercents, selectedTag, salePercentDrafts])
  const saleRecordAmountTotal = useMemo(
    () => saleRecordRows.reduce((sum, row) => sum + row.saleAmount, 0),
    [saleRecordRows]
  )

  useEffect(() => {
    const tagPercents = saleRecordPercents[selectedTag] ?? {}
    const next: Record<string, string> = {}
    gstRows.forEach((row) => {
      const n = Number(tagPercents[row.gstKey]) || 0
      next[row.gstKey] = n ? String(n) : ""
    })
    setSalePercentDrafts(next)
  }, [selectedTag, saleRecordPercents, gstRows])
  const itemCount = showGstWise
    ? gstReport.lines.length
    : groupRows.reduce((sum, row) => sum + row.items, 0)

  if (catalogs.length === 0) return null

  const tagLabel = selectedTag === ALL_ORDER_TAGS ? "all order tags" : selectedTag
  const gstLabelText = gstFilterLabel(selectedGst)
  const filterLabel = `${tagLabel} · ${gstLabelText}`

  const exportReport = async (kind: "summary" | "full" | "record") => {
    setExporting(kind)
    try {
      if (kind === "summary") {
        await downloadGstWiseSummaryReport(catalogs, selectedTag, gstPercents)
      } else if (kind === "record") {
        await downloadGstSaleRecordReport(catalogs, selectedTag, gstPercents, saleRecordPercents)
      } else {
        await downloadGstWiseSaleReport(catalogs, selectedTag, gstPercents)
      }
    } finally {
      setExporting(null)
    }
  }

  const commitSalePercent = (gstKey: string, raw: string) => {
    const n = Number(raw)
    const percent = Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : 0
    const next: GstSaleRecordPercents = {
      ...saleRecordPercents,
      [selectedTag]: {
        ...(saleRecordPercents[selectedTag] ?? {}),
      },
    }
    if (percent > 0) {
      next[selectedTag][gstKey] = percent
    } else {
      delete next[selectedTag][gstKey]
      if (Object.keys(next[selectedTag]).length === 0) delete next[selectedTag]
    }
    void onSaveSaleRecordPercents?.(next)
  }

  return (
    <div className="space-y-6">
    <Card className="border-teal-100 shadow-md">
      <CardHeader className="gap-4 sm:flex-row sm:items-start sm:justify-between space-y-0">
        <div className="min-w-0 space-y-1">
          <CardTitle className="flex items-center gap-2 text-lg">
            {showGstWise ? <Percent className="h-5 w-5 text-teal-600" /> : <BarChart3 className="h-5 w-5 text-teal-600" />}
            {showGstWise ? "GST-wise purchase" : "Purchase by catalog group"}
          </CardTitle>
          <CardDescription>
            {showGstWise
              ? "All GST selected — totals by GST slab (0, 5, 12, 18, 28…). Taxable is qty × rate; GST is added separately."
              : "Filtered by GST %. Total purchase is price × MOQ (GST not included)."}
          </CardDescription>
        </div>
        <div className="flex w-full shrink-0 flex-col gap-3 sm:w-auto sm:flex-row sm:items-end">
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
          <Button
            variant="outline"
            className="gap-2 border-teal-200 text-teal-800 hover:bg-teal-50"
            disabled={exporting != null || gstReport.lines.length === 0}
            onClick={() => void exportReport("summary")}
          >
            {exporting === "summary" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            GST Summary
          </Button>
          <Button
            variant="outline"
            className="gap-2"
            disabled={exporting != null || gstReport.lines.length === 0}
            onClick={() => void exportReport("full")}
          >
            {exporting === "full" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            Full Report
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="rounded-xl border border-teal-100 bg-teal-50/60 px-4 py-3">
            <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-teal-700">
              <IndianRupee className="h-3.5 w-3.5" />
              {showGstWise ? "Taxable" : "Total purchase"}
            </p>
            <p className="mt-1 text-2xl font-black tabular-nums text-teal-900">{formatInr(grandTotal)}</p>
            <p className="text-xs text-teal-700/80">{filterLabel}</p>
          </div>
          {showGstWise ? (
            <>
              <div className="rounded-xl border border-amber-100 bg-amber-50/60 px-4 py-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700">GST amount</p>
                <p className="mt-1 text-2xl font-black tabular-nums text-amber-900">{formatInr(gstAmountTotal)}</p>
                <p className="text-xs text-amber-700/80">On taxable value</p>
              </div>
              <div className="rounded-xl border border-sky-100 bg-sky-50/60 px-4 py-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-sky-700">MRP</p>
                <p className="mt-1 text-2xl font-black tabular-nums text-sky-900">{formatInr(saleTotal)}</p>
                <p className="text-xs text-sky-700/80">Qty × sale price</p>
              </div>
            </>
          ) : null}
          <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
            <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
              {showGstWise ? <Percent className="h-3.5 w-3.5" /> : <Package className="h-3.5 w-3.5" />}
              {showGstWise ? "GST slabs" : "Catalog groups"}
            </p>
            <p className="mt-1 text-2xl font-black tabular-nums text-slate-800">{rows.length}</p>
            <p className="text-xs text-slate-500">{itemCount} product{itemCount === 1 ? "" : "s"}</p>
          </div>
        </div>

        {showGstWise ? (
          gstRows.every((row) => row.items === 0) ? (
            <div className="flex h-[240px] items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/60 text-sm text-slate-400">
              No purchase for {filterLabel}.
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-5">
              <div className="h-[300px] lg:col-span-3">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={gstRows} margin={{ top: 8, right: 8, left: 4, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                    <XAxis
                      dataKey="label"
                      interval={0}
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
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
                        const row = payload[0].payload as (typeof gstRows)[number]
                        return (
                          <div className="rounded-lg border bg-white p-3 shadow-lg">
                            <p className="text-sm font-semibold text-slate-800">GST {row.label}</p>
                            <p className="text-lg font-black text-teal-800">{formatInr(row.taxable)}</p>
                            <p className="text-xs text-slate-500">GST amt {formatInr(row.gstAmount)}</p>
                            <p className="text-xs text-slate-500">Total {formatInr(row.total)} · MRP Sale {formatInr(row.saleValue)}</p>
                            <p className="text-xs text-slate-400">{row.items} products · {tagLabel}</p>
                          </div>
                        )
                      }}
                    />
                    <Bar dataKey="taxable" radius={[6, 6, 0, 0]} maxBarSize={56}>
                      {gstRows.map((row, index) => (
                        <Cell key={row.gstKey} fill={chartFillAt(index)} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="max-h-[300px] overflow-y-auto rounded-xl border border-slate-100 lg:col-span-2">
                <table className="w-full text-left text-sm">
                  <thead className="sticky top-0 bg-slate-50">
                    <tr className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      <th className="px-3 py-2">GST %</th>
                      <th className="px-3 py-2 text-right">Taxable</th>
                      <th className="px-3 py-2 text-right">Amount</th>
                      <th className="px-3 py-2 text-right">MRP</th>
                    </tr>
                  </thead>
                  <tbody>
                    {gstRows.map((row, index) => (
                      <tr key={row.gstKey} className="border-t border-slate-100">
                        <td className="px-3 py-2">
                          <span className="flex items-center gap-2 font-medium text-slate-800">
                            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: chartFillAt(index) }} />
                            {row.label}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right font-bold tabular-nums text-slate-900">
                          {formatInr(row.taxable)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-slate-600">
                          {formatInr(row.gstAmount)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-sky-800">
                          {formatInr(row.saleValue)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )
        ) : groupRows.length === 0 ? (
          <div className="flex h-[240px] items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/60 text-sm text-slate-400">
            No purchase for {filterLabel}.
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-5">
            <div className="h-[300px] lg:col-span-3">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={groupRows} margin={{ top: 8, right: 8, left: 4, bottom: 48 }}>
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
                      const row = payload[0].payload as (typeof groupRows)[number]
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
                    {groupRows.map((row) => (
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
                  {groupRows.map((row) => (
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

    {showGstWise && !gstRows.every((row) => row.items === 0) ? (
      <Card className="border-sky-100 shadow-md">
        <CardHeader className="gap-4 sm:flex-row sm:items-start sm:justify-between space-y-0">
          <div className="min-w-0 space-y-1">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Percent className="h-5 w-5 text-sky-600" />
              GST Sale record
            </CardTitle>
            <CardDescription>
              Same GST summary as above. Enter Sale % — Sale Amount is that percent of Taxable (e.g. 100% of ₹76,993.62 = ₹76,993.62).
            </CardDescription>
          </div>
          <Button
            variant="outline"
            className="gap-2 border-sky-200 text-sky-800 hover:bg-sky-50"
            disabled={exporting != null}
            onClick={() => void exportReport("record")}
          >
            {exporting === "record" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            GST Sale PDF
          </Button>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-xl border border-slate-100">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50">
                <tr className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  <th className="px-3 py-2">GST</th>
                  <th className="px-3 py-2 text-right">Taxable</th>
                  <th className="px-3 py-2 text-right">GST Amt</th>
                  <th className="px-3 py-2 text-right">MRP Sale</th>
                  <th className="px-3 py-2 text-right">Sale %</th>
                  <th className="px-3 py-2 text-right">Sale Amount</th>
                </tr>
              </thead>
              <tbody>
                {saleRecordRows.map((row, index) => (
                  <tr key={row.gstKey} className="border-t border-slate-100">
                    <td className="px-3 py-2">
                      <span className="flex items-center gap-2 font-medium text-slate-800">
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: chartFillAt(index) }} />
                        {row.label}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right font-bold tabular-nums text-slate-900">
                      {formatInr(row.taxable)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-600">
                      {formatInr(row.gstAmount)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-sky-800">
                      {formatInr(row.saleValue)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        step="0.01"
                        className="ml-auto h-8 w-20 text-right"
                        placeholder="0"
                        value={salePercentDrafts[row.gstKey] ?? ""}
                        onChange={(e) =>
                          setSalePercentDrafts((prev) => ({ ...prev, [row.gstKey]: e.target.value }))
                        }
                        onBlur={(e) => commitSalePercent(row.gstKey, e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") e.currentTarget.blur()
                        }}
                      />
                    </td>
                    <td className="px-3 py-2 text-right font-black tabular-nums text-teal-800">
                      {formatInr(row.saleAmount)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-200 bg-slate-50 font-bold">
                  <td className="px-3 py-2">Total</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatInr(grandTotal)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatInr(gstAmountTotal)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatInr(saleTotal)}</td>
                  <td className="px-3 py-2" />
                  <td className="px-3 py-2 text-right tabular-nums text-teal-800">{formatInr(saleRecordAmountTotal)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>
    ) : null}
    </div>
  )
}
