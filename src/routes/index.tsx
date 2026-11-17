import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { RestaurantCard } from "@/components/site/RestaurantCard";
import { restaurantsQuery } from "@/lib/queries";
import mealPacksPhoto from "@/assets/home-meal-packs.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "meals4cheap — Restaurant meal packs for students" },
      {
        name: "description",
        content: "Build a discounted pack of meals from one local restaurant and pick it all up in one 1-hour window.",
      },
      { property: "og:title", content: "meals4cheap — Restaurant meal packs for students" },
      {
        property: "og:description",
        content: "Build a discounted pack of meals from one local restaurant and pick it all up in one 1-hour window.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Home,
});

const steps = [
  { n: "01", title: "Choose a restaurant and your meals", body: "Mix any dishes into one pack, within the restaurant's meal range." },
  { n: "02", title: "Pay once", body: "One card payment for the whole pack, with the discount already applied." },
  { n: "03", title: "Restaurant confirms", body: "Your card is only charged after the restaurant confirms your order." },
  { n: "04", title: "Pick up in a 1-hour window", body: "Show your 6-character order code and take your whole pack home." },
];

const faqs = [
  {
    q: "Who can join?",
    a: "Any college student with a .edu email address. You confirm your email through a link before your first order.",
  },
  {
    q: "How do discounts work?",
    a: "Each restaurant sets its own discount, from 5% to 50%, and a minimum and maximum number of meals per pack. Your pack price is the menu price of the dishes you pick, minus that discount.",
  },
  {
    q: "What happens if the restaurant declines?",
    a: "Your card hold is released and you are not charged. The same happens if the restaurant does not answer within 30 minutes of its pickup hours.",
  },
  {
    q: "How does pickup work?",
    a: "You choose a 1-hour pickup window at checkout. Go to the restaurant during that window, show your order code, and collect all your meals at once. There is no delivery.",
  },
];

function Home() {
  const restaurants = useQuery(restaurantsQuery());
  return (
    <div>
      <section className="container-page grid gap-12 py-16 sm:py-24 lg:grid-cols-[1.2fr_1fr] lg:items-center">
        <div>
          <h1 className="text-4xl font-semibold leading-[1.05] sm:text-5xl lg:text-6xl">
            A week of restaurant meals, picked up in one trip.
          </h1>
          <p className="mt-6 max-w-xl text-lg text-muted-foreground">
            Build a pack of meals from one local restaurant at a student discount, pay once, and pick everything up during a
            1-hour window.
          </p>
          <div className="mt-8">
            <Button asChild size="lg">
              <Link to="/restaurants">Browse restaurants</Link>
            </Button>
          </div>
        </div>
        <div className="relative lg:pb-10">
          <img
            src={mealPacksPhoto}
            alt="Six takeaway containers of restaurant meals next to a paper pickup bag"
            width={1600}
            height={1000}
            className="aspect-[16/10] w-full rounded-xl border object-cover lg:aspect-[4/5]"
          />
          <div className="relative mx-auto -mt-10 w-[88%] max-w-sm lg:absolute lg:-left-10 lg:bottom-0 lg:mt-0 lg:w-72">
            <HeroTicket />
          </div>
        </div>
      </section>

      <section className="border-y bg-card">
        <div className="container-page py-16">
          <h2 className="text-2xl font-semibold sm:text-3xl">How it works</h2>
          <ol className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((s) => (
              <li key={s.n} className="flex flex-col gap-2">
                <span className="font-mono text-sm text-muted-foreground">{s.n}</span>
                <h3 className="text-lg font-semibold">{s.title}</h3>
                <p className="text-sm text-muted-foreground">{s.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="container-page py-16">
        <div className="flex items-end justify-between gap-4">
          <h2 className="text-2xl font-semibold sm:text-3xl">Restaurants</h2>
          <Link to="/restaurants" className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
            See all
          </Link>
        </div>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {restaurants.isLoading ? (
            [0, 1, 2].map((i) => <div key={i} className="surface h-44 animate-pulse bg-panel" />)
          ) : restaurants.isError ? (
            <p className="text-sm text-muted-foreground">Restaurants could not be loaded right now.</p>
          ) : restaurants.data && restaurants.data.length > 0 ? (
            restaurants.data.slice(0, 6).map((r) => <RestaurantCard key={r.id} r={r} />)
          ) : (
            <p className="text-sm text-muted-foreground">No restaurants yet. Check back soon.</p>
          )}
        </div>
      </section>

      <section className="container-page">
        <div className="surface flex flex-col gap-6 bg-panel p-8 sm:flex-row sm:items-center sm:justify-between sm:p-10">
          <div className="max-w-xl">
            <h2 className="text-2xl font-semibold">Are you a restaurant?</h2>
            <p className="mt-2 text-muted-foreground">
              Get larger, pre-scheduled orders from students. You set the discount, the pack size and the pickup hours.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button asChild variant="outline">
              <Link to="/for-restaurants">Learn more</Link>
            </Button>
            <Button asChild>
              <Link to="/restaurant-signup">Restaurant sign-up</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="container-page max-w-3xl py-16">
        <h2 className="text-2xl font-semibold sm:text-3xl">Questions</h2>
        <Accordion type="single" collapsible className="mt-6">
          {faqs.map((f) => (
            <AccordionItem key={f.q} value={f.q}>
              <AccordionTrigger className="text-left text-base">{f.q}</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">{f.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>
    </div>
  );
}

/** Illustrative ticket showing how a pack price is built. Uses example numbers, labelled as such. */
function HeroTicket() {
  return (
    <div className="ticket w-full p-5 text-sm" aria-label="Example pack price">
      <div className="flex items-center justify-between text-xs uppercase tracking-wider text-muted-foreground">
        <span>Example pack</span>
        <span>Pickup ticket</span>
      </div>
      <div className="ticket-divider my-4" />
      <ul className="space-y-2">
        <li className="flex justify-between"><span>3 x Dish at $12.00</span><span>$36.00</span></li>
        <li className="flex justify-between"><span>2 x Dish at $10.00</span><span>$20.00</span></li>
      </ul>
      <div className="ticket-divider my-4" />
      <div className="space-y-2">
        <div className="flex justify-between text-muted-foreground"><span>Menu price</span><span>$56.00</span></div>
        <div className="flex justify-between text-muted-foreground"><span>Discount 25%</span><span>-$14.00</span></div>
        <div className="flex justify-between text-base font-semibold"><span>You pay</span><span>$42.00</span></div>
      </div>
      <div className="ticket-divider my-4" />
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>5 meals</span>
        <span>One 1-hour pickup</span>
      </div>
    </div>
  );
}
