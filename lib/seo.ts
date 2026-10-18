import type { Metadata } from "next"

/** Canonical production origin. Apex 308-redirects to www. */
export const SITE_URL = "https://www.betmandarin.online"
export const SITE_NAME = "Mandarin"
export const DEFAULT_TITLE = "Mandarin — Live Sports Arbitrage"
export const DEFAULT_DESCRIPTION =
  "Real-time cross-book arbitrage across US sportsbooks. Find guaranteed edges the moment lines diverge."

export const OG_IMAGE = {
  url: "/opengraph-image",
  width: 1200,
  height: 630,
  alt: "Mandarin — live sports arbitrage across US sportsbooks",
} as const

type PageMetadataOptions = {
  title: string
  description: string
  /** Path beginning with `/`, or `/` for the homepage. */
  path: string
  /** Keep `title` as written instead of applying the root `%s · Mandarin` template. */
  absoluteTitle?: boolean
  /** Emit `noindex, follow`. Use for pages that should not be ranked. */
  noindex?: boolean
}

/**
 * Per-page metadata. Relative `path` values are resolved against `metadataBase`
 * in the root layout, so canonical and Open Graph URLs are absolute.
 */
export function pageMetadata({
  title,
  description,
  path,
  absoluteTitle = false,
  noindex = false,
}: PageMetadataOptions): Metadata {
  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    alternates: { canonical: path },
    robots: noindex ? { index: false, follow: true } : { index: true, follow: true },
    openGraph: {
      title,
      description,
      url: path,
      siteName: SITE_NAME,
      type: "website",
      locale: "en_US",
      images: [{ ...OG_IMAGE }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [OG_IMAGE.url],
    },
  }
}

export const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: SITE_NAME,
  url: SITE_URL,
  description: DEFAULT_DESCRIPTION,
  logo: {
    "@type": "ImageObject",
    url: `${SITE_URL}/apple-icon`,
    width: 180,
    height: 180,
  },
}

export const websiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: SITE_NAME,
  url: SITE_URL,
  description: DEFAULT_DESCRIPTION,
  publisher: {
    "@type": "Organization",
    name: SITE_NAME,
    url: SITE_URL,
  },
}
