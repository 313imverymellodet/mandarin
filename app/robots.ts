import type { MetadataRoute } from "next"
import { SITE_URL } from "@/lib/seo"

/**
 * /arbitrage is the product dashboard. /account is the authenticated profile.
 * Both require a session (see lib/supabase/middleware.ts). /sign-in is the login page.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/sign-in", "/arbitrage", "/account"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  }
}
