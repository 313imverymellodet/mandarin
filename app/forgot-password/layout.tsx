import type { Metadata } from "next"
import type { ReactNode } from "react"
import { pageMetadata } from "@/lib/seo"

export const metadata: Metadata = pageMetadata({
  title: "Reset your password",
  description: "Request a password reset link for your Mandarin account.",
  path: "/forgot-password",
  noindex: true,
})

export default function ForgotPasswordLayout({ children }: { children: ReactNode }) {
  return children
}
