import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — meals4cheap" },
      { name: "description", content: "Placeholder privacy policy for meals4cheap." },
      { property: "og:title", content: "Privacy Policy — meals4cheap" },
      { property: "og:description", content: "Placeholder privacy policy for meals4cheap." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <div className="container-page max-w-2xl py-12">
      <h1 className="text-3xl font-semibold">Privacy Policy</h1>
      <div className="surface mt-6 bg-panel p-5 text-sm">
        This is a placeholder. The final privacy policy will be published here before launch.
      </div>
    </div>
  );
}
