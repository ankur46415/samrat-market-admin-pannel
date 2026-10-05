"use client"

import { useEffect } from "react"

const PREFETCH_PATHS = ["/", "/login", "/generate-bill", "/generate-bill/scan"]

export function PwaRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return

    // Service workers cache old JS/CSS and cause hydration errors on localhost during dev.
    if (process.env.NODE_ENV === "development") {
      void navigator.serviceWorker.getRegistrations().then((registrations) => {
        for (const registration of registrations) {
          void registration.unregister()
        }
      })
      return
    }

    void navigator.serviceWorker.register("/sw.js").catch((error) => {
      console.warn("Service worker registration failed", error)
    })

    PREFETCH_PATHS.forEach((path) => {
      void fetch(path, { credentials: "same-origin" }).catch(() => undefined)
    })
  }, [])

  return null
}
