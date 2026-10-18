import type { MetadataRoute } from "next"
import { SITE_URL } from "@/lib/seo"

/** Public, indexable routes. Auth, dashboard, and account URLs are omitted. */
const routes: { path: string; changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"]; priority: number }[] =
  [
    { path: "/", changeFrequency: "daily", priority: 1 },
    { path: "/how-it-works", changeFrequency: "monthly", priority: 0.8 },
    { path: "/what-is-arbitrage-betting", changeFrequency: "monthly", priority: 0.8 },
    { path: "/pricing", changeFrequency: "monthly", priority: 0.5 },
    { path: "/sign-up", changeFrequency: "yearly", priority: 0.4 },
  ]

export default function sitemap(): MetadataRoute.Sitemap {
  return routes.map(({ path, changeFrequency, priority }) => ({
    url: path === "/" ? SITE_URL : `${SITE_URL}${path}`,
    changeFrequency,
    priority,
  }))
}
