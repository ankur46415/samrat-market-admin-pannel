"use client"

import { useEffect } from "react"

const PREFETCH_PATHS = ["/", "/login", "/generate-bill", "/generate-bill/scan"]

export function PwaRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return

    void navigator.serviceWorker.register("/sw.js").catch((error) => {
      console.warn("Service worker registration failed", error)
    })

    PREFETCH_PATHS.forEach((path) => {
      void fetch(path, { credentials: "same-origin" }).catch(() => undefined)
    })
  }, [])

  return null
}
