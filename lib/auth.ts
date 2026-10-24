import { betterAuth } from "better-auth"
import { nextCookies } from "better-auth/next-js"
import { config } from "@/lib/config"
import { getPool } from "@/lib/db"

/**
 * Better Auth, backed by the Railway Postgres pool. Accounts, sessions and
 * password hashes live in our own database (tables: user, session, account,
 * verification — created by `npm run db:migrate`).
 *
 * Server-only. Returns null when DATABASE_URL / BETTER_AUTH_SECRET are unset
 * so the app still builds and runs without auth configured.
 */

/** Public origin used in reset links and OAuth callbacks. */
export function authBaseUrl(): string | undefined {
  const explicit = process.env.BETTER_AUTH_URL ?? process.env.NEXT_PUBLIC_SITE_URL
  if (explicit) return explicit.replace(/\/$/, "")
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL
  return vercel ? `https://${vercel}` : undefined
}

async function sendResetEmail(to: string, url: string): Promise<void> {
  if (!config.auth.resendApiKey) {
    // No email provider yet: log the link so an admin can pass it along.
    console.warn(`[auth] Password reset requested for ${to}. Reset link (valid 1h): ${url}`)
    return
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${config.auth.resendApiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: config.auth.emailFrom,
      to,
      subject: "Reset your Mandarin password",
      html: `<p>Someone asked to reset the password for your Mandarin account.</p><p><a href="${url}">Choose a new password</a> (link expires in 1 hour).</p><p>If this wasn't you, ignore this email.</p>`,
    }),
  })
  if (!res.ok) console.error(`[auth] reset email failed: ${res.status} ${await res.text().catch(() => "")}`)
}

function createAuth() {
  const pool = getPool()
  if (!pool || !config.auth.secret) return null

  const { google, github } = config.auth
  const baseURL = authBaseUrl()

  return betterAuth({
    database: pool,
    secret: config.auth.secret,
    ...(baseURL ? { baseURL, trustedOrigins: [baseURL] } : {}),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      // Friends beta: no email confirmation step.
      requireEmailVerification: false,
      autoSignIn: true,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, url }) => sendResetEmail(user.email, url),
    },
    socialProviders: {
      ...(google.clientId && google.clientSecret
        ? { google: { clientId: google.clientId, clientSecret: google.clientSecret } }
        : {}),
      ...(github.clientId && github.clientSecret
        ? { github: { clientId: github.clientId, clientSecret: github.clientSecret } }
        : {}),
    },
    session: {
      expiresIn: 60 * 60 * 24 * 30, // 30 days
      updateAge: 60 * 60 * 24, // refresh expiry at most daily
    },
    // Must be last: lets server actions set auth cookies via next/headers.
    plugins: [nextCookies()],
  })
}

type Auth = NonNullable<ReturnType<typeof createAuth>>

const globalForAuth = globalThis as unknown as { __mandarinAuth?: Auth | null }

export function getAuth(): Auth | null {
  if (globalForAuth.__mandarinAuth === undefined) globalForAuth.__mandarinAuth = createAuth()
  return globalForAuth.__mandarinAuth
}

/** Which social sign-in buttons should be shown. */
export function enabledOAuthProviders(): ("google" | "github")[] {
  const { google, github } = config.auth
  return [
    ...(google.clientId && google.clientSecret ? (["google"] as const) : []),
    ...(github.clientId && github.clientSecret ? (["github"] as const) : []),
  ]
}
