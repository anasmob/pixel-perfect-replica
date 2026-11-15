import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthCard, FieldError } from "@/components/site/AuthCard";
import { supabase } from "@/integrations/supabase/client";
import { safeRedirect } from "@/lib/validation";

export const Route = createFileRoute("/login")({
  validateSearch: (s: Record<string, unknown>): { redirect?: string | undefined; confirmed?: string | undefined } => ({
    redirect: typeof s["redirect"] === "string" ? s["redirect"] : undefined,
    confirmed: typeof s["confirmed"] === "string" ? s["confirmed"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Log in — meals4cheap" },
      { name: "description", content: "Log in to order meal packs or manage your restaurant." },
      { property: "og:title", content: "Log in — meals4cheap" },
      { property: "og:description", content: "Log in to order meal packs or manage your restaurant." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const search = Route.useSearch();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) {
      setBusy(false);
      setError(
        /confirm/i.test(error.message)
          ? "Please confirm your email first. Check your inbox for the verification link."
          : "Email or password is incorrect.",
      );
      return;
    }
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", data.user.id);
    const isRestaurant = roles?.some((r) => r.role === "restaurant");
    await router.navigate({ href: isRestaurant ? "/dashboard" : safeRedirect(search.redirect), replace: true });
  };

  return (
    <AuthCard
      title="Log in"
      subtitle={
        <>
          New here? <Link to="/signup" className="text-foreground underline underline-offset-4">Create a student account</Link>
        </>
      }
    >
      {search.confirmed ? (
        <p className="mb-4 rounded-lg bg-panel p-3 text-sm">Your email is confirmed. You can log in now.</p>
      ) : null}
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" autoComplete="email" required className="mt-1.5 h-11" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="password">Password</Label>
          <Input id="password" type="password" autoComplete="current-password" required className="mt-1.5 h-11" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <FieldError>{error}</FieldError>
        <Button type="submit" className="w-full" disabled={busy || !email || !password}>
          {busy ? "Logging in…" : "Log in"}
        </Button>
      </form>
      <p className="mt-6 text-sm text-muted-foreground">
        Restaurant? <Link to="/restaurant-signup" className="text-foreground underline underline-offset-4">Apply here</Link>
      </p>
    </AuthCard>
  );
}
