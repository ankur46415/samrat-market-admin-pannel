"use client"

import { useEffect } from "react"
import { usePathname, useRouter } from "next/navigation"
import { canAccessPath, useSessionUser } from "@/lib/auth-session"

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
    if (!canAccessPath(user.role, pathname)) {
      router.replace("/")
    }
  }, [ready, user, pathname, router])

  if (!ready) {
    return <div className="p-6 text-sm text-muted-foreground">Loading...</div>
  }

  if (!user || !canAccessPath(user.role, pathname)) return null

  return <>{children}</>
}

