"use server"

import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { config } from "@/lib/config"

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

const NOT_CONFIGURED: ActionResult = {
  error: "Authentication isn't configured yet. Add your Supabase keys to enable sign in.",
}

export async function signInWithPassword(formData: FormData): Promise<ActionResult> {
  const parsed = credentials.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." }

  const supabase = await createClient()
  if (!supabase) return NOT_CONFIGURED

  const { error } = await supabase.auth.signInWithPassword(parsed.data)
  if (error) return { error: error.message }
  return { success: true }
}

export async function signUpWithPassword(formData: FormData): Promise<ActionResult> {
  const parsed = credentials.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." }

  const supabase = await createClient()
  if (!supabase) return NOT_CONFIGURED

  const { data, error } = await supabase.auth.signUp({
    ...parsed.data,
    options: { emailRedirectTo: `${config.site.url}/auth/callback` },
  })
  if (error) return { error: error.message }

  // When email confirmation is on, there's no active session yet.
  if (data.user && !data.session) {
    return { success: true, message: "Check your email to confirm your account." }
  }
  return { success: true }
}

export async function requestPasswordReset(formData: FormData): Promise<ActionResult> {
  const parsed = emailOnly.safeParse({ email: formData.get("email") })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid email." }

  const supabase = await createClient()
  if (!supabase) return NOT_CONFIGURED

  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${config.site.url}/auth/callback?next=/account`,
  })
  if (error) return { error: error.message }
  return { success: true, message: "If that email exists, a reset link is on its way." }
}

export async function signInWithOAuth(provider: "google" | "github"): Promise<ActionResult> {
  const supabase = await createClient()
  if (!supabase) return NOT_CONFIGURED

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: `${config.site.url}/auth/callback` },
  })
  if (error) return { error: error.message }
  return { success: true, redirectUrl: data.url }
}

export async function signOut(): Promise<void> {
  const supabase = await createClient()
  if (supabase) await supabase.auth.signOut()
}
