"use client"

import { useEffect } from "react"
import { usePathname, useRouter } from "next/navigation"
import { canAccessPath, defaultHomePath, useSessionUser } from "@/lib/auth-session"

export function AdminAuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const { user, ready } = useSessionUser()

  useEffect(() => {
    if (!ready) return
    if (!user) {
      router.replace("/login")
      return
    }
    if (!canAccessPath(user, pathname)) {
      router.replace(defaultHomePath(user))
    }
  }, [ready, user, pathname, router])

  if (!ready) {
    return <div className="p-6 text-sm text-muted-foreground">Loading...</div>
  }

  if (!user || !canAccessPath(user, pathname)) return null

  return <>{children}</>
}

