import type { Metadata } from "next"
import type { ReactNode } from "react"
import { pageMetadata } from "@/lib/seo"

export const metadata: Metadata = pageMetadata({
  title: "Create an account",
  description: "Create a Mandarin account to compare live odds across US sportsbooks.",
  path: "/sign-up",
})

export default function SignUpLayout({ children }: { children: ReactNode }) {
  return children
}
