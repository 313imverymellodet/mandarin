"use client"

import Link from "next/link"
import { ArrowRight, Menu, Moon, Sun, X } from "lucide-react"
import { useTheme } from "next-themes"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { MandarinLogo } from "@/components/mandarin-logo"
import { paymentsEnabled } from "@/lib/payments"

export function Header() {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  useEffect(() => setMounted(true), [])

  const isDark = mounted && resolvedTheme === "dark"
  const closeMenu = () => setIsMobileMenuOpen(false)

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur">
      <div className="container mx-auto flex items-center justify-between px-4 py-3 sm:py-4">
        <div className="flex items-center gap-4 sm:gap-8">
          <Link href="/" className="flex items-center gap-2" aria-label="Mandarin home">
            <MandarinLogo className="h-8 w-8 sm:h-9 sm:w-9" />
            <span className="text-lg font-semibold tracking-tight sm:text-xl">Mandarin</span>
          </Link>
          <nav className="hidden items-center gap-6 md:flex" aria-label="Primary navigation">
            <Link href="/arbitrage" className="text-sm font-medium transition-colors hover:text-orange-500">
              Dashboard
            </Link>
            {paymentsEnabled && (
              <Link href="/pricing" className="text-sm font-medium transition-colors hover:text-orange-500">
                Pricing
              </Link>
            )}
          </nav>
        </div>

        <div className="flex items-center gap-2 sm:gap-4">
          <button
            type="button"
            onClick={() => setTheme(isDark ? "light" : "dark")}
            className="rounded-md p-2 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
            aria-pressed={isDark}
          >
            {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>
          <button
            type="button"
            className="rounded-md p-2 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:hidden"
            onClick={() => setIsMobileMenuOpen((open) => !open)}
            aria-label={isMobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
            aria-expanded={isMobileMenuOpen}
            aria-controls="mobile-navigation"
          >
            {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <Button asChild className="hidden h-9 gap-2 bg-orange-500 text-sm text-white hover:bg-orange-600 sm:flex">
            <Link href="/sign-in">
              Sign in <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>

      {isMobileMenuOpen && (
        <nav id="mobile-navigation" className="flex flex-col gap-3 border-t border-border bg-background px-4 py-4 md:hidden" aria-label="Mobile navigation">
          <Link href="/arbitrage" onClick={closeMenu} className="text-sm font-medium transition-colors hover:text-orange-500">
            Dashboard
          </Link>
          {paymentsEnabled && (
            <Link href="/pricing" onClick={closeMenu} className="text-sm font-medium transition-colors hover:text-orange-500">
              Pricing
            </Link>
          )}
          <Button asChild className="w-full gap-2 bg-orange-500 text-white hover:bg-orange-600">
            <Link href="/sign-in" onClick={closeMenu}>
              Sign in <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </nav>
      )}
    </header>
  )
}
