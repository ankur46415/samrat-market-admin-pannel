"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Camera, CameraOff, Loader2 } from "lucide-react"
import { BrowserMultiFormatReader, type IScannerControls } from "@zxing/browser"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { normalizeScannedBarcode } from "@/lib/stock"

type CameraBarcodeScannerDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onScan: (code: string) => void
  title?: string
  /** Keep camera open and accept multiple scans (POS / mobile billing). */
  continuous?: boolean
  /** Show toast on each successful scan (off when continuous to reduce noise). */
  toastOnScan?: boolean
}

function pickPreferredCameraDeviceId(
  devices: MediaDeviceInfo[]
): string | undefined {
  if (devices.length === 0) return undefined
  const back = devices.find((d) =>
    /back|rear|environment|trás|arrière/i.test(d.label)
  )
  if (back) return back.deviceId
  return devices[devices.length - 1]?.deviceId
}

export function CameraBarcodeScannerDialog({
  open,
  onOpenChange,
  onScan,
  title = "Scan barcode",
  continuous = false,
  toastOnScan = true,
}: CameraBarcodeScannerDialogProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const controlsRef = useRef<IScannerControls | null>(null)
  const readerRef = useRef<BrowserMultiFormatReader | null>(null)
  const handledRef = useRef(false)
  const lastCodeRef = useRef("")
  const lastCodeAtRef = useRef(0)
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const stopScanner = useCallback(() => {
    controlsRef.current?.stop()
    controlsRef.current = null
    readerRef.current = null
  }, [])

  useEffect(() => {
    if (!open) {
      stopScanner()
      setStarting(false)
      setError(null)
      handledRef.current = false
      lastCodeRef.current = ""
      lastCodeAtRef.current = 0
      return
    }

    handledRef.current = false
    lastCodeRef.current = ""
    lastCodeAtRef.current = 0
    let cancelled = false

    const start = async () => {
      setStarting(true)
      setError(null)

      if (typeof window !== "undefined" && !window.isSecureContext) {
        setError("Camera scanning needs HTTPS (or localhost).")
        setStarting(false)
        return
      }

      if (!navigator.mediaDevices?.getUserMedia) {
        setError("This browser does not support camera access.")
        setStarting(false)
        return
      }

      const video = videoRef.current
      if (!video) {
        setStarting(false)
        return
      }

      try {
        const reader = new BrowserMultiFormatReader()
        readerRef.current = reader
        const devices = await BrowserMultiFormatReader.listVideoInputDevices()
        const deviceId = pickPreferredCameraDeviceId(devices)

        const controls = await reader.decodeFromVideoDevice(
          deviceId,
          video,
          (result, err, ctrl) => {
            if (cancelled) return
            if (result) {
              const cleaned = normalizeScannedBarcode(result.getText())
              if (!cleaned) return

              if (continuous) {
                const now = Date.now()
                if (
                  cleaned === lastCodeRef.current &&
                  now - lastCodeAtRef.current < 1200
                ) {
                  return
                }
                lastCodeRef.current = cleaned
                lastCodeAtRef.current = now
                onScan(cleaned)
                if (toastOnScan) toast.success(`Scanned: ${cleaned}`)
                return
              }

              if (handledRef.current) return
              handledRef.current = true
              ctrl.stop()
              controlsRef.current = null
              onScan(cleaned)
              onOpenChange(false)
              if (toastOnScan) toast.success(`Scanned: ${cleaned}`)
              return
            }
            if (err && err.name !== "NotFoundException") {
              console.debug("Camera scan frame:", err)
            }
          }
        )

        if (cancelled) {
          controls.stop()
          return
        }
        controlsRef.current = controls
        setStarting(false)
      } catch (e) {
        console.error(e)
        const msg =
          e instanceof Error
            ? e.message.includes("Permission") || e.name === "NotAllowedError"
              ? "Camera permission denied. Allow camera access in browser settings."
              : e.message
            : "Could not start camera"
        setError(msg)
        setStarting(false)
      }
    }

    void start()

    return () => {
      cancelled = true
      stopScanner()
    }
  }, [open, onOpenChange, onScan, stopScanner, continuous, toastOnScan])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-md">
        <DialogHeader className="space-y-1 px-4 pb-2 pt-4 text-left">
          <DialogTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5 text-primary" />
            {title}
          </DialogTitle>
          <DialogDescription>
            {continuous
              ? "Scan each product — camera stays open until you close. Rear camera is used on phones when available."
              : "Point the camera at the barcode. On phones, the rear camera is used when available."}
          </DialogDescription>
        </DialogHeader>

        <div className="relative aspect-[4/3] w-full bg-black">
          <video
            ref={videoRef}
            className="h-full w-full object-cover"
            muted
            playsInline
            autoPlay
          />
          {starting ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/50 text-white">
              <Loader2 className="h-8 w-8 animate-spin" />
              <span className="text-sm">Starting camera…</span>
            </div>
          ) : null}
          {!starting && !error ? (
            <div
              className="pointer-events-none absolute inset-[12%] rounded-lg border-2 border-primary/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)_inset]"
              aria-hidden
            />
          ) : null}
        </div>

        <div className="space-y-3 px-4 py-4">
          {error ? (
            <p className="flex items-start gap-2 text-sm text-destructive">
              <CameraOff className="mt-0.5 h-4 w-4 shrink-0" />
              {error}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Hold steady until the code is detected. Works with EAN, UPC, Code 128, and similar
              retail barcodes.
            </p>
          )}
          <Button type="button" variant="outline" className="w-full" onClick={() => onOpenChange(false)}>
            {continuous ? "Done scanning" : "Cancel"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
