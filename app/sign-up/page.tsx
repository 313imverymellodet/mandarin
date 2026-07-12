"use client"

import type React from "react"
import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { MandarinLogo } from "@/components/mandarin-logo"
import { useRouter } from "next/navigation"
import { ArrowLeft, Eye, EyeOff, Mail, Lock, User, Check, AlertCircle } from "lucide-react"
import { signUpWithPassword, signInWithOAuth } from "@/app/auth/actions"

export default function SignUpPage() {
  const router = useRouter()
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [agreedToTerms, setAgreedToTerms] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const passwordRequirements = [
    { label: "At least 8 characters", met: password.length >= 8 },
    { label: "Contains a number", met: /\d/.test(password) },
    { label: "Contains uppercase letter", met: /[A-Z]/.test(password) },
  ]

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!agreedToTerms) return
    setError(null)
    setNotice(null)
    setIsLoading(true)
    const formData = new FormData()
    formData.set("email", email)
    formData.set("password", password)
    formData.set("name", name)
    const result = await signUpWithPassword(formData)
    if (result.error) {
      setError(result.error)
      setIsLoading(false)
      return
    }
    if (result.message) {
      setNotice(result.message)
      setIsLoading(false)
      return
    }
    router.push("/arbitrage")
    router.refresh()
  }

  const handleOAuth = async (provider: "google" | "github") => {
    setError(null)
    setIsLoading(true)
    const result = await signInWithOAuth(provider)
    if (result.redirectUrl) {
      window.location.href = result.redirectUrl
      return
    }
    setError(result.error ?? "Couldn't start sign in.")
    setIsLoading(false)
  }

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left side - Form */}
      <div className="flex-1 flex flex-col justify-center px-4 sm:px-6 lg:px-8 py-12">
        <div className="mx-auto w-full max-w-sm">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-8 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to home
          </Link>

          <div className="flex items-center gap-3 mb-8">
            <MandarinLogo className="w-10 h-10" />
            <span className="text-2xl font-bold">Mandarin</span>
          </div>

          <h1 className="text-2xl font-bold mb-2">Create your account</h1>
          <p className="text-muted-foreground mb-8">Start finding arbitrage opportunities today</p>

          {error && (
            <div
              role="alert"
              className="mb-4 flex items-start gap-2 rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-600 dark:text-red-400"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}
          {notice && (
            <div
              role="status"
              className="mb-4 flex items-start gap-2 rounded-md border border-green-500/30 bg-green-500/10 p-3 text-sm text-green-600 dark:text-green-400"
            >
              <Check className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <span>{notice}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full name</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="name"
                  name="name"
                  type="text"
                  autoComplete="name"
                  placeholder="Your name"
                  className="pl-10"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  spellCheck={false}
                  placeholder="you@example.com"
                  className="pl-10"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="Create a password"
                  className="pl-10 pr-10"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
                </button>
              </div>
              {password.length > 0 && (
                <div className="mt-2 space-y-1">
                  {passwordRequirements.map((req) => (
                    <div key={req.label} className="flex items-center gap-2 text-xs">
                      <Check className={`h-3 w-3 ${req.met ? "text-green-500" : "text-muted-foreground"}`} />
                      <span className={req.met ? "text-green-500" : "text-muted-foreground"}>{req.label}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-start gap-2">
              <Checkbox
                id="terms"
                checked={agreedToTerms}
                onCheckedChange={(checked) => setAgreedToTerms(checked as boolean)}
                className="mt-1"
              />
              <Label htmlFor="terms" className="text-sm text-muted-foreground font-normal leading-5">
                I agree to the{" "}
                <Link href="#" className="text-orange-500 hover:text-orange-600">
                  Terms of Service
                </Link>{" "}
                and{" "}
                <Link href="#" className="text-orange-500 hover:text-orange-600">
                  Privacy Policy
                </Link>
              </Label>
            </div>

            <Button
              type="submit"
              className="w-full bg-orange-500 hover:bg-orange-600 text-white"
              disabled={isLoading || !agreedToTerms}
            >
              {isLoading ? "Creating account..." : "Create Account"}
            </Button>
          </form>

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">Or continue with</span>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <Button
                variant="outline"
                className="w-full bg-transparent"
                onClick={() => handleOAuth("google")}
                disabled={isLoading}
              >
                <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="currentColor"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                Google
              </Button>
              <Button
                variant="outline"
                className="w-full bg-transparent"
                onClick={() => handleOAuth("github")}
                disabled={isLoading}
              >
                <svg className="h-4 w-4 mr-2" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                </svg>
                GitHub
              </Button>
            </div>
          </div>

          <p className="mt-8 text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href="/sign-in" className="text-orange-500 hover:text-orange-600 font-medium">
              Sign in
            </Link>
          </p>
        </div>
      </div>

      {/* Right side - Branding */}
      <div className="hidden lg:flex flex-1 bg-gradient-to-br from-orange-500 to-amber-500 items-center justify-center p-12">
        <div className="max-w-md text-white text-center">
          <MandarinLogo className="w-24 h-24 mx-auto mb-8" />
          <h2 className="text-3xl font-bold mb-4">Start making smarter bets</h2>
          <p className="text-orange-100 text-lg mb-8">
            Join thousands of users finding guaranteed profit opportunities.
          </p>
          <div className="space-y-4 text-left">
            {[
              "Real-time arbitrage scanning across US sportsbooks",
              "Instant alerts for new opportunities",
              "Detailed profit calculations",
              "Risk assessment for each trade",
            ].map((feature) => (
              <div key={feature} className="flex items-center gap-3">
                <div className="h-5 w-5 rounded-full bg-white/20 flex items-center justify-center">
                  <Check className="h-3 w-3" />
                </div>
                <span className="text-orange-50">{feature}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
