import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthCard, FieldError } from "@/components/site/AuthCard";
import { supabase } from "@/integrations/supabase/client";
import { isEduEmail } from "@/lib/validation";

export const Route = createFileRoute("/signup")({
  head: () => ({
    meta: [
      { title: "Student sign up — meals4cheap" },
      { name: "description", content: "Create a student account with your .edu email to order discounted restaurant meal packs." },
      { property: "og:title", content: "Student sign up — meals4cheap" },
      { property: "og:description", content: "Create a student account with your .edu email." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SignupPage,
});

function SignupPage() {
  const [firstName, setFirstName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!firstName.trim()) errs.firstName = "Enter your first name.";
    if (!isEduEmail(email)) errs.email = "Use your school email ending in .edu.";
    if (password.length < 8) errs.password = "Use at least 8 characters.";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/login?confirmed=1`,
        data: { role: "student", first_name: firstName.trim() },
      },
    });
    setBusy(false);
    if (error) {
      setErrors({ form: /edu/i.test(error.message) ? "Use your school email ending in .edu." : error.message });
      return;
    }
    setDone(true);
  };

  if (done) {
    return (
      <AuthCard title="Check your email">
        <p className="text-sm text-muted-foreground">
          We sent a verification link to <span className="font-medium text-foreground">{email.trim()}</span>. Click it to confirm
          your account, then log in to place your first order.
        </p>
        <Button asChild variant="outline" className="mt-6 w-full">
          <Link to="/login" search={{}}>Go to log in</Link>
        </Button>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Create a student account"
      subtitle={
        <>
          Any school with a .edu email. Already have an account?{" "}
          <Link to="/login" search={{}} className="text-foreground underline underline-offset-4">Log in</Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <div>
          <Label htmlFor="firstName">First name</Label>
          <Input id="firstName" autoComplete="given-name" className="mt-1.5 h-11" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
          <FieldError>{errors.firstName}</FieldError>
        </div>
        <div>
          <Label htmlFor="email">School email</Label>
          <Input id="email" type="email" autoComplete="email" placeholder="you@school.edu" className="mt-1.5 h-11" value={email} onChange={(e) => setEmail(e.target.value)} />
          <FieldError>{errors.email}</FieldError>
        </div>
        <div>
          <Label htmlFor="password">Password</Label>
          <Input id="password" type="password" autoComplete="new-password" className="mt-1.5 h-11" value={password} onChange={(e) => setPassword(e.target.value)} />
          <FieldError>{errors.password}</FieldError>
        </div>
        <FieldError>{errors.form}</FieldError>
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? "Creating account…" : "Sign up"}
        </Button>
        <p className="text-xs text-muted-foreground">
          By signing up you agree to the <Link to="/terms" className="underline">Terms</Link> and{" "}
          <Link to="/privacy" className="underline">Privacy policy</Link>.
        </p>
      </form>
    </AuthCard>
  );
}
