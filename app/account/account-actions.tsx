"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createClient } from "@/lib/supabase/client"
import { AlertCircle, Check } from "lucide-react"

export function UpdatePasswordForm() {
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
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error
      setDone(true)
      setPassword("")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't update password.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
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
