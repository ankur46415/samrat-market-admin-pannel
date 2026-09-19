"use client"

import { useState } from "react"
import { Check, ChevronsUpDown, FlaskConical } from "lucide-react"
import { toast } from "sonner"
import {
  PRODUCTION_ACCOUNT_PASSKEY,
  TEST_ACCOUNT_PASSKEY,
  type AccountMode,
} from "@/lib/account-mode"
import { useAccountMode } from "@/components/account-mode-provider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

const OPTIONS: { value: AccountMode; label: string }[] = [
  { value: "test", label: "Test" },
  { value: "production", label: "Production" },
]

export function AccountModeSwitcher() {
  const { mode, applyMode } = useAccountMode()
  const [pendingMode, setPendingMode] = useState<AccountMode | null>(null)
  const [password, setPassword] = useState("")

  const switchTo = (next: AccountMode) => {
    if (next === mode) return
    setPassword("")
    setPendingMode(next)
  }

  const confirmSwitch = () => {
    if (!pendingMode) return
    const expected = pendingMode === "production" ? PRODUCTION_ACCOUNT_PASSKEY : TEST_ACCOUNT_PASSKEY
    if (password.trim() !== expected) {
      toast.error("Wrong passkey")
      return
    }
    const next = pendingMode
    setPendingMode(null)
    applyMode(next)
    toast.success(next === "production" ? "Switched to Production" : "Switched to Test")
  }

  return (
    <>
      <div className="px-2 pb-1">
        <Label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-muted-foreground group-data-[collapsible=icon]:hidden">
          Account
        </Label>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="outline"
              className="h-8 w-full justify-between bg-sidebar-accent/40 px-2 text-xs group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:p-0"
            >
              <span className="flex min-w-0 items-center gap-1.5">
                <FlaskConical className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate group-data-[collapsible=icon]:hidden">
                  {mode === "production" ? "Production" : "Test"}
                </span>
              </span>
              <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-60 group-data-[collapsible=icon]:hidden" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" className="z-[200] w-52" sideOffset={8}>
            <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
              Switch account
            </DropdownMenuLabel>
            {OPTIONS.map((option) => (
              <DropdownMenuItem
                key={option.value}
                className="justify-between"
                onSelect={() => switchTo(option.value)}
              >
                {option.label}
                {mode === option.value ? <Check className="h-4 w-4" /> : null}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Dialog open={pendingMode != null} onOpenChange={(open) => !open && setPendingMode(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Switch to {pendingMode === "production" ? "Production" : "Test"}</DialogTitle>
            <DialogDescription>
              Enter the {pendingMode === "production" ? "Production" : "Test"} account passkey to continue.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5 py-2">
            <Label htmlFor="account-mode-pass">Passkey</Label>
            <Input
              id="account-mode-pass"
              type="password"
              inputMode={pendingMode === "test" ? "numeric" : "text"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  confirmSwitch()
                }
              }}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setPendingMode(null)}>
              Cancel
            </Button>
            <Button type="button" onClick={confirmSwitch}>
              Continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
