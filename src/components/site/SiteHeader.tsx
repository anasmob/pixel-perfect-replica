import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { Logo } from "./Logo";

export function SiteHeader() {
  const { session, role, signOut, ready } = useAuth();
  return (
    <header className="border-b bg-card/80">
      <div className="container-page flex h-16 items-center justify-between gap-4">
        <Logo />
        <nav className="flex items-center gap-1 sm:gap-2">
          <Link
            to="/restaurants"
            className="hidden rounded-md px-3 py-2 text-sm text-muted-foreground hover:text-foreground sm:inline-block"
            activeProps={{ className: "text-foreground" }}
          >
            Restaurants
          </Link>
          {!ready ? null : session ? (
            <>
              {role === "restaurant" ? (
                <Link to="/dashboard" className="rounded-md px-3 py-2 text-sm text-muted-foreground hover:text-foreground">
                  Dashboard
                </Link>
              ) : (
                <Link to="/orders" className="rounded-md px-3 py-2 text-sm text-muted-foreground hover:text-foreground">
                  My orders
                </Link>
              )}
              <Button variant="ghost" size="sm" onClick={signOut}>
                Log out
              </Button>
            </>
          ) : (
            <>
              <Link to="/login" search={{}} className="rounded-md px-3 py-2 text-sm text-muted-foreground hover:text-foreground">
                Log in
              </Link>
              <Button asChild size="sm">
                <Link to="/signup">Sign up</Link>
              </Button>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
