"use client"

import type React from "react"
import { Suspense, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { MandarinLogo } from "@/components/mandarin-logo"
import { ArrowLeft, Lock, CheckCircle, AlertCircle } from "lucide-react"
import { resetPassword } from "@/app/auth/actions"

/** Landing page for the emailed reset link: /reset-password?token=… */
function ResetPasswordForm() {
  const searchParams = useSearchParams()
  const token = searchParams.get("token") ?? ""
  const linkError = searchParams.get("error")

  const [password, setPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isDone, setIsDone] = useState(false)
  const [error, setError] = useState<string | null>(
    linkError || !token ? "This reset link is invalid or has expired. Request a new one." : null,
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)
    const formData = new FormData()
    formData.set("token", token)
    formData.set("password", password)
    const result = await resetPassword(formData)
    setIsLoading(false)
    if (result.error) {
      setError(result.error)
      return
    }
    setIsDone(true)
  }

  return (
    <div className="min-h-screen bg-background flex flex-col justify-center px-4 sm:px-6 lg:px-8 py-12">
      <div className="mx-auto w-full max-w-sm">
        <Link
          href="/sign-in"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-8 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to sign in
        </Link>

        <div className="flex items-center gap-3 mb-8">
          <MandarinLogo className="w-10 h-10" />
          <span className="text-2xl font-bold">Mandarin</span>
        </div>

        {isDone ? (
          <div className="text-center">
            <div className="w-16 h-16 bg-orange-100 dark:bg-orange-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="h-8 w-8 text-orange-500" />
            </div>
            <h1 className="text-2xl font-bold mb-2">Password updated</h1>
            <p className="text-muted-foreground mb-8">Sign in with your new password.</p>
            <Button asChild className="w-full bg-orange-500 hover:bg-orange-600 text-white">
              <Link href="/sign-in">Sign in</Link>
            </Button>
          </div>
        ) : (
          <>
            <h1 className="text-2xl font-bold mb-2">Choose a new password</h1>
            <p className="text-muted-foreground mb-8">At least 8 characters.</p>

            {error && (
              <div
                role="alert"
                className="mb-5 flex items-start gap-2 rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-600 dark:text-red-400"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                <span>
                  {error}{" "}
                  {(linkError || !token) && (
                    <Link href="/forgot-password" className="font-medium underline">
                      Get a new link
                    </Link>
                  )}
                </span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="password">New password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="new-password"
                    className="pl-10"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    minLength={8}
                    required
                    disabled={!token}
                  />
                </div>
              </div>

              <Button
                type="submit"
                className="w-full bg-orange-500 hover:bg-orange-600 text-white"
                disabled={isLoading || !token}
              >
                {isLoading ? "Saving..." : "Update password"}
              </Button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <ResetPasswordForm />
    </Suspense>
  )
}
