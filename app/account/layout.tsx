import type { Metadata } from "next"
import type { ReactNode } from "react"
import { pageMetadata } from "@/lib/seo"

export const metadata: Metadata = pageMetadata({
  title: "Account",
  description: "Your Mandarin profile, plan, and password.",
  path: "/account",
  noindex: true,
})

export default function AccountLayout({ children }: { children: ReactNode }) {
  return children
}