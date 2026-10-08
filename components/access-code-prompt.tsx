"use client"

import { FormEvent, useState } from "react"
import { KeyRound, Loader2, LogOut } from "lucide-react"
import { verifyAccessCode, writeStoredAccess } from "@/lib/access-codes"
import { logoutFirebase, type SessionUser } from "@/lib/auth-session"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

export function AccessCodePrompt({ user }: { user: SessionUser }) {
  const [code, setCode] = useState("")
  const [error, setError] = useState("")
  const [checking, setChecking] = useState(false)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setError("")
    if (!/^\d{6}$/.test(code)) {
      setError("Enter your 6-digit access code.")
      return
    }
    setChecking(true)
    try {
      const access = await verifyAccessCode(code, user.email)
      if (!access) {
        setError("That access code is not valid for this login.")
        return
      }
      writeStoredAccess(user.email, access)
      window.location.reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not check the access code.")
    } finally {
      setChecking(false)
    }
  }

  return (
    <div className="flex min-h-[70vh] items-center justify-center p-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5" />
            Enter your access code
          </CardTitle>
          <CardDescription>
            This login is shared. Your 6-digit code marks every change you make with your name.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-3" onSubmit={(event) => void onSubmit(event)}>
            <Input
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="6-digit code"
              className="text-center font-mono text-lg tracking-[0.4em]"
              autoFocus
            />
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <Button type="submit" className="w-full" disabled={checking}>
              {checking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Continue
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              onClick={() => {
                void logoutFirebase().then(() => window.location.assign("/login"))
              }}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Log out
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
