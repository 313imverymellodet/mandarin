import type { Metadata } from "next"
import type { ReactNode } from "react"
import { pageMetadata } from "@/lib/seo"

export const metadata: Metadata = pageMetadata({
  title: "Arbitrage scanner",
  description: "Live cross-book odds scanner for US sportsbooks. Requires a signed-in Mandarin account.",
  path: "/arbitrage",
  noindex: true,
})

export default function ArbitrageLayout({ children }: { children: ReactNode }) {
  return children
}
