"use client"

import { useEffect } from "react"
import { usePathname, useRouter } from "next/navigation"
import { canAccessPath, defaultHomePath, useSessionUser } from "@/lib/auth-session"
import { verifyAccessCode, writeStoredAccess } from "@/lib/access-codes"
import { AccessCodePrompt } from "@/components/access-code-prompt"

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
    if (user.requiresAccessCode && !user.accessCode) return
    if (!canAccessPath(user, pathname)) {
      router.replace(defaultHomePath(user))
    }
  }, [ready, user, pathname, router])

  useEffect(() => {
    if (!user?.requiresAccessCode || !user.accessCode || !navigator.onLine) return
    let cancelled = false
    void verifyAccessCode(user.accessCode, user.email)
      .then((access) => {
        if (cancelled || access) return
        writeStoredAccess(user.email, null)
        window.location.reload()
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [user?.requiresAccessCode, user?.accessCode, user?.email])

  if (!ready) {
    return <div className="p-6 text-sm text-muted-foreground">Loading...</div>
  }

  if (user?.requiresAccessCode && !user.accessCode) return <AccessCodePrompt user={user} />

  if (!user || !canAccessPath(user, pathname)) return null

  return <>{children}</>
}
