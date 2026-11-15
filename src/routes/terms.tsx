import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Service — meals4cheap" },
      { name: "description", content: "Placeholder terms of service for meals4cheap." },
      { property: "og:title", content: "Terms of Service — meals4cheap" },
      { property: "og:description", content: "Placeholder terms of service for meals4cheap." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <div className="container-page max-w-2xl py-12">
      <h1 className="text-3xl font-semibold">Terms of Service</h1>
      <div className="surface mt-6 bg-panel p-5 text-sm">
        This is a placeholder. The final terms of service will be published here before launch.
      </div>
    </div>
  );
}
