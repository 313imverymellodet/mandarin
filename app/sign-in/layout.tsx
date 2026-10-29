import type { Metadata } from "next"
import type { ReactNode } from "react"
import { pageMetadata } from "@/lib/seo"

export const metadata: Metadata = pageMetadata({
  title: "Sign in",
  description: "Sign in to Mandarin to open the live sportsbook arbitrage scanner.",
  path: "/sign-in",
  noindex: true,
})

export default function SignInLayout({ children }: { children: ReactNode }) {
  return children
}
