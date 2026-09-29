/**
 * Single deterministic entrypoint for Mandarin's plain-assertion market tests.
 * Add `tsx` as a dev dependency and point `npm test` at this file so every core
 * engine is validated instead of only `edge.test.ts`.
 */
import "./arbitrage.test"
import "./edge.test"
import "./middles.test"
import "./settlement-math.test"
import "./edge-history.test"
import "./portfolio.test"
import "./production-config.test"
import "./invariants.test"
import "../safe-redirect.test"

console.log("test-all.ts: every Mandarin market-engine assertion passed")
