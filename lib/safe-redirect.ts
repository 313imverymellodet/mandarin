/**
 * Sanitize a user-supplied post-auth redirect target. Only same-origin
 * absolute paths are allowed; anything that could leave the site
 * ("//evil.com", "/\\evil.com", "https://evil.com", "@evil.com" appended to
 * an origin, "javascript:…") falls back to `fallback`.
 */
export function safeRedirectPath(value: string | null | undefined, fallback = "/arbitrage"): string {
  if (!value) return fallback
  if (!value.startsWith("/")) return fallback
  if (value.startsWith("//") || value.startsWith("/\\")) return fallback
  // Control characters (tabs/newlines are stripped by URL parsers) can turn
  // "/\t/evil.com" into "//evil.com".
  if (/[\u0000-\u001f\u007f]/.test(value)) return fallback
  return value
}
