import type { Metadata } from "next"
import type { ReactNode } from "react"
import { SiteFooter } from "@/components/site-footer"
import { pageMetadata } from "@/lib/seo"

export const metadata: Metadata = pageMetadata({
  title: "Pricing",
  description:
    "Mandarin pricing. During open beta every feature is free; paid plans apply only when billing is turned on.",
  path: "/pricing",
})

export default function PricingLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <SiteFooter />
    </>
  )
}
