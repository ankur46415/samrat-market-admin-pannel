"use client"

import { useState, useCallback } from "react"
import Papa from "papaparse"
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useProducts } from "@/hooks/use-firestore"
import { toast } from "sonner"
import { RACK_OPTIONS_SET } from "@/lib/rack-options"

interface CsvUploadDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface CsvRow {
  name: string
  category: string
  tag?: string
  status?: string
  price: string
  costPrice: string
  stock: string
  unit: string
  barcode?: string
  minStock?: string
  rack?: string
}

export function CsvUploadDialog({ open, onOpenChange }: CsvUploadDialogProps) {
  const { bulkAddProducts } = useProducts()
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [previewData, setPreviewData] = useState<CsvRow[]>([])

  const resetState = useCallback(() => {
    setUploading(false)
    setProgress(0)
    setError(null)
    setSuccess(false)
    setPreviewData([])
  }, [])

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    resetState()

    Papa.parse<CsvRow>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.errors.length > 0) {
          setError(`CSV parsing error: ${results.errors[0].message}`)
          return
        }

        const validRows = results.data.filter(
          (row) => row.name && row.category && row.price && row.costPrice
        )

        if (validRows.length === 0) {
          setError("No valid rows found. Make sure your CSV has: name, category, price, costPrice columns")
          return
        }

        setPreviewData(validRows.slice(0, 5))
      },
      error: (error) => {
        setError(`Failed to parse CSV: ${error.message}`)
      },
    })

    // Store file for later upload
    const reader = new FileReader()
    reader.onload = (event) => {
      const csvText = event.target?.result as string
      sessionStorage.setItem("csv_upload_data", csvText)
    }
    reader.readAsText(file)
  }, [resetState])

  const handleUpload = async () => {
    const csvText = sessionStorage.getItem("csv_upload_data")
    if (!csvText) {
      setError("No CSV data found. Please select a file again.")
      return
    }

    setUploading(true)
    setError(null)

    Papa.parse<CsvRow>(csvText, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const validRows = results.data.filter(
          (row) => row.name && row.category && row.price && row.costPrice
        )

        try {
          const defaultRack = "R-1"
          const products = validRows.map((row) => ({
            name: row.name.trim(),
            category: row.category.trim(),
            tag: row.tag?.trim() || "",
            status: row.status?.trim() || "",
            rack:
              row.rack?.trim() &&
              RACK_OPTIONS_SET.has(row.rack.trim() as any)
                ? row.rack.trim()
                : defaultRack,
            price: parseFloat(row.price) || 0,
            costPrice: parseFloat(row.costPrice) || 0,
            stock: parseInt(row.stock) || 0,
            unit: row.unit?.trim() || "pcs",
            barcode: row.barcode?.trim() || undefined,
            minStock: parseInt(row.minStock || "10") || 10,
          }))

          // Simulate progress
          for (let i = 0; i <= 100; i += 10) {
            setProgress(i)
            await new Promise((r) => setTimeout(r, 100))
          }

          await bulkAddProducts(products)
          
          setSuccess(true)
          toast.success(`Successfully imported ${products.length} products`)
          sessionStorage.removeItem("csv_upload_data")
          
          setTimeout(() => {
            onOpenChange(false)
            resetState()
          }, 2000)
        } catch (err) {
          console.error("Upload error:", err)
          setError("Failed to upload products. Please try again.")
        } finally {
          setUploading(false)
        }
      },
    })
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) resetState()
      onOpenChange(isOpen)
    }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Import Products from CSV</DialogTitle>
          <DialogDescription>
            Upload a CSV file with your product data. Required columns: name, category, price, costPrice
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {!success && (
            <div className="border-2 border-dashed rounded-lg p-6 text-center">
              <input
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                className="hidden"
                id="csv-upload"
                disabled={uploading}
              />
              <label
                htmlFor="csv-upload"
                className="flex flex-col items-center cursor-pointer"
              >
                <FileSpreadsheet className="h-10 w-10 text-muted-foreground mb-2" />
                <span className="text-sm font-medium">Click to upload CSV</span>
                <span className="text-xs text-muted-foreground mt-1">
                  or drag and drop
                </span>
              </label>
            </div>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {success && (
            <Alert className="border-green-500 bg-green-50 dark:bg-green-950">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <AlertDescription className="text-green-700 dark:text-green-300">
                Products imported successfully!
              </AlertDescription>
            </Alert>
          )}

          {previewData.length > 0 && !success && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Preview (first 5 rows):</p>
              <div className="rounded border overflow-auto max-h-40">
                <table className="w-full text-xs">
                  <thead className="bg-muted">
                    <tr>
                      <th className="p-2 text-left">Name</th>
                      <th className="p-2 text-left">Category</th>
                      <th className="p-2 text-right">Price</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewData.map((row, i) => (
                      <tr key={i} className="border-t">
                        <td className="p-2">{row.name}</td>
                        <td className="p-2">{row.category}</td>
                        <td className="p-2 text-right">{row.price}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {uploading && (
            <div className="space-y-2">
              <Progress value={progress} />
              <p className="text-sm text-center text-muted-foreground">
                Uploading... {progress}%
              </p>
            </div>
          )}

          {previewData.length > 0 && !success && (
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => resetState()}>
                Cancel
              </Button>
              <Button onClick={handleUpload} disabled={uploading}>
                <Upload className="mr-2 h-4 w-4" />
                {uploading ? "Uploading..." : "Upload Products"}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
