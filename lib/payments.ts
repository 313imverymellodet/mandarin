/**
 * Client-safe flag for whether billing is live. Driven by the public Stripe
 * key so it can be read in both client and server components. When false the
 * app runs in "free / open beta" mode: no checkout, no upgrade prompts.
 *
 * Flip it on simply by setting the Stripe env vars (see .env.example).
 */
export const paymentsEnabled = Boolean(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)
