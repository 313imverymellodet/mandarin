import Link from "next/link"
import { MandarinLogo } from "@/components/mandarin-logo"
import { paymentsEnabled } from "@/lib/payments"

const links = [
  { href: "/how-it-works", label: "How it works" },
  { href: "/what-is-arbitrage-betting", label: "What is arbitrage betting?" },
  { href: "/arbitrage", label: "Dashboard" },
  ...(paymentsEnabled ? [{ href: "/pricing", label: "Pricing" }] : []),
  { href: "/sign-up", label: "Sign up" },
  { href: "/sign-in", label: "Sign in" },
]

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-background">
      <div className="container mx-auto flex flex-col gap-6 px-4 py-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <Link href="/" className="flex items-center gap-2" aria-label="Mandarin home">
            <MandarinLogo className="h-7 w-7" />
            <span className="font-semibold">Mandarin</span>
          </Link>
          <nav aria-label="Footer" className="flex max-w-xl flex-wrap gap-x-5 gap-y-2 text-sm">
            {links.map((link) => (
              <Link key={link.href} href={link.href} className="text-muted-foreground transition-colors hover:text-foreground">
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
        <p className="max-w-3xl text-xs leading-relaxed text-muted-foreground">
          Mandarin compares sportsbook prices. It does not place bets. A price can change between refresh and placement,
          and an edge that is still on the screen may already be gone at the book. Informational only — not financial,
          tax, or legal advice. Betting rules depend on where you live.
        </p>
      </div>
    </footer>
  )
}
