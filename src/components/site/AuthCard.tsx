import type { ReactNode } from "react";

export function AuthCard({ title, subtitle, children }: { title: string; subtitle?: ReactNode; children: ReactNode }) {
  return (
    <div className="container-page flex justify-center py-12 sm:py-20">
      <div className="surface w-full max-w-md p-6 sm:p-8">
        <h1 className="text-2xl font-semibold">{title}</h1>
        {subtitle ? <div className="mt-2 text-sm text-muted-foreground">{subtitle}</div> : null}
        <div className="mt-6">{children}</div>
      </div>
    </div>
  );
}

export function FieldError({ children }: { children?: ReactNode }) {
  if (!children) return null;
  return <p className="mt-1.5 text-sm text-destructive">{children}</p>;
}
