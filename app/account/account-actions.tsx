"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AlertCircle, Check } from "lucide-react"

export function UpdatePasswordForm() {
  const [currentPassword, setCurrentPassword] = useState("")
  const [password, setPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password.length < 8) {
      setError("Password must be at least 8 characters.")
      return
    }
    setError(null)
    setIsLoading(true)
    setDone(false)
    // Call the auth endpoint directly (not a server action): revoking other
    // sessions issues a new session cookie, and a server action would
    // re-render this page with the old, now-revoked cookie and sign you out.
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword: password, revokeOtherSessions: true }),
      })
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { message?: string }
        setError(data.message ?? "Couldn't update password.")
        setIsLoading(false)
        return
      }
    } catch {
      setError("Couldn't update password.")
      setIsLoading(false)
      return
    }
    setIsLoading(false)
    setDone(true)
    setCurrentPassword("")
    setPassword("")
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <Label htmlFor="current-password">Current password</Label>
      <Input
        id="current-password"
        type="password"
        value={currentPassword}
        onChange={(e) => setCurrentPassword(e.target.value)}
        autoComplete="current-password"
      />
      <Label htmlFor="new-password">New password</Label>
      <Input
        id="new-password"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="At least 8 characters"
        autoComplete="new-password"
      />
      {error && (
        <p className="flex items-center gap-1.5 text-sm text-red-600 dark:text-red-400">
          <AlertCircle className="h-4 w-4" /> {error}
        </p>
      )}
      {done && (
        <p className="flex items-center gap-1.5 text-sm text-green-600 dark:text-green-400">
          <Check className="h-4 w-4" /> Password updated.
        </p>
      )}
      <Button type="submit" disabled={isLoading} className="bg-orange-500 hover:bg-orange-600 text-white">
        {isLoading ? "Saving..." : "Update password"}
      </Button>
    </form>
  )
}

export function ManageBillingButton({ hasCustomer }: { hasCustomer: boolean }) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const openPortal = async () => {
    setError(null)
    setIsLoading(true)
    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" })
      const data = await res.json()
      if (!res.ok || !data.url) throw new Error(data.error ?? "Couldn't open billing portal.")
      window.location.href = data.url
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.")
      setIsLoading(false)
    }
  }

  if (!hasCustomer) return null

  return (
    <div className="space-y-2">
      <Button onClick={openPortal} disabled={isLoading} variant="outline">
        {isLoading ? "Opening..." : "Manage billing"}
      </Button>
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
    </div>
  )
}
