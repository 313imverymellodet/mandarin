import Link from "next/link"
import { redirect } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { MandarinLogo } from "@/components/mandarin-logo"
import { getCurrentUser } from "@/lib/supabase/server"
import { getSubscription, isSubscriptionActive } from "@/lib/subscription"
import { config } from "@/lib/config"
import { UpdatePasswordForm, ManageBillingButton } from "./account-actions"

export const dynamic = "force-dynamic"

export default async function AccountPage() {
  const user = await getCurrentUser()
  if (!user) redirect("/sign-in?redirectTo=/account")

  const subscription = await getSubscription()
  const active = isSubscriptionActive(subscription)
  const planLabel = active ? (subscription?.plan ?? "Pro") : "Free"

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="container mx-auto flex items-center justify-between px-4 py-3">
          <Link href="/" className="flex items-center gap-2">
            <MandarinLogo className="h-8 w-8" />
            <span className="text-lg font-semibold">Mandarin</span>
          </Link>
          <Button asChild variant="ghost" size="sm" className="gap-2">
            <Link href="/arbitrage">
              <ArrowLeft className="h-4 w-4" /> Dashboard
            </Link>
          </Button>
        </div>
      </header>

      <main className="container mx-auto max-w-2xl space-y-6 px-4 py-10">
        <h1 className="text-2xl font-bold">Account</h1>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Profile</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p className="text-muted-foreground">Signed in as</p>
            <p className="font-medium">{user.email}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between text-base">
              Plan
              <Badge variant={active ? "default" : "secondary"} className={active ? "bg-orange-500 capitalize text-white" : "capitalize"}>
                {planLabel}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            {active ? (
              <p className="text-muted-foreground">
                {subscription?.cancel_at_period_end
                  ? "Your plan is set to cancel at the end of the current period."
                  : "Your subscription is active."}
                {subscription?.current_period_end &&
                  ` Renews ${new Date(subscription.current_period_end).toLocaleDateString()}.`}
              </p>
            ) : (
              <p className="text-muted-foreground">
                You&apos;re on the free plan.{" "}
                <Link href="/pricing" className="text-orange-500 hover:text-orange-600">
                  Upgrade for full access
                </Link>
                .
              </p>
            )}
            {config.stripe.enabled ? (
              <ManageBillingButton hasCustomer={Boolean(subscription?.stripe_customer_id)} />
            ) : (
              <p className="text-xs text-muted-foreground">Billing isn&apos;t configured on this deployment.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Password</CardTitle>
          </CardHeader>
          <CardContent>
            <UpdatePasswordForm />
          </CardContent>
        </Card>

        <form action="/auth/sign-out" method="post">
          <Button type="submit" variant="outline">
            Sign out
          </Button>
        </form>
      </main>
    </div>
  )
}
