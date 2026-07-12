"use client"

import type React from "react"
import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { MandarinLogo } from "@/components/mandarin-logo"
import { ArrowLeft, Mail, CheckCircle, AlertCircle } from "lucide-react"
import { requestPasswordReset } from "@/app/auth/actions"

export default function ForgotPasswordPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [email, setEmail] = useState("")
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)
    const formData = new FormData()
    formData.set("email", email)
    const result = await requestPasswordReset(formData)
    setIsLoading(false)
    if (result.error) {
      setError(result.error)
      return
    }
    setIsSubmitted(true)
  }

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left side - Form */}
      <div className="flex-1 flex flex-col justify-center px-4 sm:px-6 lg:px-8 py-12">
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

          {!isSubmitted ? (
            <>
              <h1 className="text-2xl font-bold mb-2">Reset your password</h1>
              <p className="text-muted-foreground mb-8">
                Enter your email address and we'll send you a link to reset your password.
              </p>

              {error && (
                <div
                  role="alert"
                  className="mb-5 flex items-start gap-2 rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-600 dark:text-red-400"
                >
                  <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="email">Email address</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="you@example.com"
                      className="pl-10"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full bg-orange-500 hover:bg-orange-600 text-white"
                  disabled={isLoading}
                >
                  {isLoading ? "Sending..." : "Send Reset Link"}
                </Button>
              </form>
            </>
          ) : (
            <div className="text-center">
              <div className="w-16 h-16 bg-orange-100 dark:bg-orange-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle className="h-8 w-8 text-orange-500" />
              </div>
              <h1 className="text-2xl font-bold mb-2">Check your email</h1>
              <p className="text-muted-foreground mb-6">
                We've sent a password reset link to <span className="font-medium text-foreground">{email}</span>
              </p>
              <p className="text-sm text-muted-foreground mb-8">
                Didn't receive the email? Check your spam folder or{" "}
                <button
                  onClick={() => setIsSubmitted(false)}
                  className="text-orange-500 hover:text-orange-600 font-medium"
                >
                  try again
                </button>
              </p>
              <Button asChild variant="outline" className="w-full bg-transparent">
                <Link href="/sign-in">Return to sign in</Link>
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Right side - Branding */}
      <div className="hidden lg:flex flex-1 bg-gradient-to-br from-orange-500 to-amber-500 items-center justify-center p-12">
        <div className="max-w-md text-white text-center">
          <MandarinLogo className="w-24 h-24 mx-auto mb-8" />
          <h2 className="text-3xl font-bold mb-4">Don't worry, it happens!</h2>
          <p className="text-orange-100 text-lg">
            We'll help you get back to finding those arbitrage opportunities in no time.
          </p>
        </div>
      </div>
    </div>
  )
}
