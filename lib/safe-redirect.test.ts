import { safeRedirectPath } from "./safe-redirect"

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

assert(safeRedirectPath("/account") === "/account", "Same-origin path is kept")
assert(
  safeRedirectPath("/pricing?checkout=cancelled") === "/pricing?checkout=cancelled",
  "Query string is kept",
)
assert(safeRedirectPath(null) === "/arbitrage", "Missing value uses the default fallback")
assert(safeRedirectPath("") === "/arbitrage", "Empty value uses the default fallback")
assert(safeRedirectPath(null, "/home") === "/home", "Custom fallback is honored")

for (const hostile of [
  "https://evil.com",
  "//evil.com",
  "/\\evil.com",
  "@evil.com",
  "javascript:alert(1)",
  "/\t/evil.com",
  "/\n/evil.com",
  "evil.com",
]) {
  assert(safeRedirectPath(hostile) === "/arbitrage", `Rejects ${JSON.stringify(hostile)}`)
}

console.log("safe-redirect.test.ts: all assertions passed")
