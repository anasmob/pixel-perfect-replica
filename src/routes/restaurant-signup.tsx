import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthCard, FieldError } from "@/components/site/AuthCard";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/restaurant-signup")({
  head: () => ({
    meta: [
      { title: "Restaurant sign-up — meals4cheap" },
      { name: "description", content: "Apply to sell discounted meal packs to college students on meals4cheap." },
      { property: "og:title", content: "Restaurant sign-up — meals4cheap" },
      { property: "og:description", content: "Apply to sell discounted meal packs to college students." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RestaurantSignupPage,
});

const fields = [
  { id: "restaurant_name", label: "Restaurant name", autoComplete: "organization" },
  { id: "cuisine", label: "Cuisine", placeholder: "e.g. Mexican, Thai, Grain bowls" },
  { id: "address", label: "Address", autoComplete: "street-address" },
  { id: "contact_name", label: "Contact name", autoComplete: "name" },
  { id: "phone", label: "Phone", autoComplete: "tel", type: "tel" },
  { id: "email", label: "Email", autoComplete: "email", type: "email" },
  { id: "password", label: "Password", autoComplete: "new-password", type: "password" },
] as const;

type Values = Record<(typeof fields)[number]["id"], string>;

function RestaurantSignupPage() {
  const [values, setValues] = useState<Values>({
    restaurant_name: "",
    cuisine: "",
    address: "",
    contact_name: "",
    phone: "",
    email: "",
    password: "",
  });
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    for (const f of fields) if (!values[f.id].trim()) errs[f.id] = `Enter ${f.label.toLowerCase()}.`;
    if (values.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) errs["email"] = "Enter a valid email.";
    if (values.password && values.password.length < 8) errs["password"] = "Use at least 8 characters.";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    const { error } = await supabase.auth.signUp({
      email: values.email.trim(),
      password: values.password,
      options: {
        emailRedirectTo: `${window.location.origin}/login?confirmed=1`,
        data: {
          role: "restaurant",
          restaurant_name: values.restaurant_name.trim(),
          cuisine: values.cuisine.trim(),
          address: values.address.trim(),
          contact_name: values.contact_name.trim(),
          phone: values.phone.trim(),
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
      },
    });
    setBusy(false);
    if (error) {
      setErrors({ form: error.message });
      return;
    }
    setDone(true);
  };

  if (done) {
    return (
      <AuthCard title="Your application is pending approval.">
        <p className="text-sm text-muted-foreground">
          Thanks for applying. Please confirm your email using the link we sent to{" "}
          <span className="font-medium text-foreground">{values.email.trim()}</span>. Once approved, your restaurant becomes
          visible to students. You can log in now to set up your menu and pickup hours.
        </p>
        <Button asChild variant="outline" className="mt-6 w-full">
          <Link to="/login" search={{}}>Go to log in</Link>
        </Button>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Restaurant sign-up"
      subtitle={
        <>
          Applications are reviewed by hand. <Link to="/for-restaurants" className="text-foreground underline underline-offset-4">How it works</Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {fields.map((f) => (
          <div key={f.id}>
            <Label htmlFor={f.id}>{f.label}</Label>
            <Input
              id={f.id}
              type={"type" in f ? f.type : "text"}
              autoComplete={"autoComplete" in f ? f.autoComplete : undefined}
              placeholder={"placeholder" in f ? f.placeholder : undefined}
              className="mt-1.5 h-11"
              value={values[f.id]}
              onChange={(e) => setValues({ ...values, [f.id]: e.target.value })}
            />
            <FieldError>{errors[f.id]}</FieldError>
          </div>
        ))}
        <FieldError>{errors["form"]}</FieldError>
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? "Submitting…" : "Submit application"}
        </Button>
      </form>
    </AuthCard>
  );
}
