import { Link } from "@tanstack/react-router";

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t">
      <div className="container-page flex flex-col gap-4 py-10 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <p>meals4cheap · Restaurant meal packs for students. Pickup only.</p>
        <nav className="flex flex-wrap gap-x-5 gap-y-2">
          <Link to="/restaurants" className="hover:text-foreground">Restaurants</Link>
          <Link to="/for-restaurants" className="hover:text-foreground">For restaurants</Link>
          <Link to="/terms" className="hover:text-foreground">Terms</Link>
          <Link to="/privacy" className="hover:text-foreground">Privacy</Link>
        </nav>
      </div>
    </footer>
  );
}
