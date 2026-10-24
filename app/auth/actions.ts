"use server"

import { headers } from "next/headers"
import { z } from "zod"
import { enabledOAuthProviders, getAuth } from "@/lib/auth"

export interface ActionResult {
  error?: string
  success?: boolean
  message?: string
  /** For OAuth: URL to redirect the browser to. */
  redirectUrl?: string
}

const credentials = z.object({
  email: z.string().email("Enter a valid email address."),
  password: z.string().min(8, "Password must be at least 8 characters."),
})

const emailOnly = z.object({ email: z.string().email("Enter a valid email address.") })
const newPassword = z.string().min(8, "Password must be at least 8 characters.")

const NOT_CONFIGURED: ActionResult = {
  error: "Sign in isn't available right now. Please try again shortly.",
}

/** Better Auth throws APIError; surface its message, never a stack. */
function messageOf(error: unknown, fallback: string): string {
  const body = (error as { body?: { message?: string } })?.body
  if (body?.message) return body.message
  if (error instanceof Error && error.message) return error.message
  return fallback
}

export async function signInWithPassword(formData: FormData): Promise<ActionResult> {
  const parsed = credentials.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." }

  const auth = getAuth()
  if (!auth) return NOT_CONFIGURED
  try {
    await auth.api.signInEmail({ body: parsed.data, headers: await headers() })
    return { success: true }
  } catch (error) {
    return { error: messageOf(error, "Invalid email or password.") }
  }
}

export async function signUpWithPassword(formData: FormData): Promise<ActionResult> {
  const parsed = credentials.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." }

  const name = (formData.get("name") as string | null)?.trim() || parsed.data.email.split("@")[0]

  const auth = getAuth()
  if (!auth) return NOT_CONFIGURED
  try {
    await auth.api.signUpEmail({ body: { ...parsed.data, name }, headers: await headers() })
    return { success: true }
  } catch (error) {
    return { error: messageOf(error, "Couldn't create your account.") }
  }
}

export async function requestPasswordReset(formData: FormData): Promise<ActionResult> {
  const parsed = emailOnly.safeParse({ email: formData.get("email") })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid email." }

  const auth = getAuth()
  if (!auth) return NOT_CONFIGURED
  try {
    await auth.api.requestPasswordReset({
      body: { email: parsed.data.email, redirectTo: "/reset-password" },
      headers: await headers(),
    })
  } catch (error) {
    console.error("password reset request failed:", messageOf(error, "unknown"))
  }
  // Same answer whether or not the account exists (no account enumeration).
  return { success: true, message: "If that email exists, a reset link is on its way." }
}

export async function resetPassword(formData: FormData): Promise<ActionResult> {
  const token = String(formData.get("token") ?? "")
  const parsed = newPassword.safeParse(formData.get("password"))
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid password." }
  if (!token) return { error: "This reset link is invalid or has expired. Request a new one." }

  const auth = getAuth()
  if (!auth) return NOT_CONFIGURED
  try {
    await auth.api.resetPassword({ body: { newPassword: parsed.data, token }, headers: await headers() })
    return { success: true }
  } catch (error) {
    return { error: messageOf(error, "This reset link is invalid or has expired. Request a new one.") }
  }
}

export async function getOAuthProviders(): Promise<("google" | "github")[]> {
  return getAuth() ? enabledOAuthProviders() : []
}

export async function signInWithOAuth(provider: "google" | "github"): Promise<ActionResult> {
  const auth = getAuth()
  if (!auth) return NOT_CONFIGURED
  if (!enabledOAuthProviders().includes(provider)) {
    return { error: `${provider === "google" ? "Google" : "GitHub"} sign-in isn't set up yet — use email instead.` }
  }
  try {
    const result = await auth.api.signInSocial({
      body: { provider, callbackURL: "/arbitrage", errorCallbackURL: "/sign-in" },
      headers: await headers(),
    })
    if (result && "url" in result && result.url) return { success: true, redirectUrl: result.url }
    return { error: "Couldn't start sign in." }
  } catch (error) {
    return { error: messageOf(error, "Couldn't start sign in.") }
  }
}

export async function signOut(): Promise<void> {
  const auth = getAuth()
  if (!auth) return
  try {
    await auth.api.signOut({ headers: await headers() })
  } catch {
    // Already signed out.
  }
}
