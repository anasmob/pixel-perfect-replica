import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { EmptyState, ErrorState, LoadingBlock } from "@/components/site/States";
import { FieldError } from "@/components/site/AuthCard";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { myRestaurantQuery } from "@/lib/dashboard-queries";
import { formatCents, MAX_DISCOUNT, MIN_DISCOUNT } from "@/lib/pricing";

export const Route = createFileRoute("/_authenticated/dashboard/menu")({
  component: MenuTab,
});

function MenuTab() {
  const { session } = useAuth();
  const rq = useQuery(myRestaurantQuery(session?.user.id));
  if (!rq.data) return <LoadingBlock />;
  return (
    <div className="grid gap-8 lg:grid-cols-[20rem_1fr]">
      <OfferForm restaurant={rq.data} />
      <DishList restaurantId={rq.data.id} />
    </div>
  );
}

function OfferForm({ restaurant }: { restaurant: { id: string; discount_percent: number; min_meals: number; max_meals: number } }) {
  const qc = useQueryClient();
  const [discount, setDiscount] = useState(String(restaurant.discount_percent));
  const [min, setMin] = useState(String(restaurant.min_meals));
  const [max, setMax] = useState(String(restaurant.max_meals));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    const d = Number(discount), mi = Number(min), ma = Number(max);
    if (!Number.isInteger(d) || d < MIN_DISCOUNT || d > MAX_DISCOUNT) return setError(`Discount must be a whole number from ${MIN_DISCOUNT} to ${MAX_DISCOUNT}.`);
    if (!Number.isInteger(mi) || mi < 1) return setError("Minimum must be at least 1 meal.");
    if (!Number.isInteger(ma) || ma < mi || ma > 50) return setError("Maximum must be between the minimum and 50.");
    setError(null);
    setBusy(true);
    const { error } = await supabase.from("restaurants").update({ discount_percent: d, min_meals: mi, max_meals: ma }).eq("id", restaurant.id);
    setBusy(false);
    if (error) return setError("Could not save. Please try again.");
    toast.success("Offer saved.");
    qc.invalidateQueries({ queryKey: ["my-restaurant"] });
    qc.invalidateQueries({ queryKey: ["restaurants"] });
  };

  return (
    <form onSubmit={save} noValidate className="surface h-fit space-y-4 p-5">
      <h2 className="text-lg font-semibold">Offer</h2>
      <div>
        <Label htmlFor="discount">Discount (%)</Label>
        <Input id="discount" type="number" min={MIN_DISCOUNT} max={MAX_DISCOUNT} className="mt-1.5 h-11 font-mono" value={discount} onChange={(e) => setDiscount(e.target.value)} />
        <p className="mt-1 text-xs text-muted-foreground">From {MIN_DISCOUNT}% to {MAX_DISCOUNT}%, applied to the whole pack.</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="min">Min meals</Label>
          <Input id="min" type="number" min={1} className="mt-1.5 h-11 font-mono" value={min} onChange={(e) => setMin(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="max">Max meals</Label>
          <Input id="max" type="number" min={1} max={50} className="mt-1.5 h-11 font-mono" value={max} onChange={(e) => setMax(e.target.value)} />
        </div>
      </div>
      <FieldError>{error}</FieldError>
      <Button type="submit" className="w-full" disabled={busy}>{busy ? "Saving…" : "Save offer"}</Button>
    </form>
  );
}

interface Dish {
  id: string;
  name: string;
  description: string;
  price_cents: number;
  is_hidden: boolean;
}

function DishList({ restaurantId }: { restaurantId: string }) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["my-dishes", restaurantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dishes")
        .select("id, name, description, price_cents, is_hidden")
        .eq("restaurant_id", restaurantId)
        .order("sort_order")
        .order("created_at");
      if (error) throw error;
      return data as Dish[];
    },
  });
  const [editing, setEditing] = useState<Dish | "new" | null>(null);
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["my-dishes", restaurantId] });
    qc.invalidateQueries({ queryKey: ["restaurant"] });
  };

  const toggleHidden = async (d: Dish) => {
    const { error } = await supabase.from("dishes").update({ is_hidden: !d.is_hidden }).eq("id", d.id);
    if (error) toast.error("Could not update the dish.");
    refresh();
  };

  return (
    <section>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Menu</h2>
        <Button size="sm" variant="outline" onClick={() => setEditing("new")}>Add dish</Button>
      </div>
      <div className="mt-4">
        {editing === "new" ? (
          <DishForm restaurantId={restaurantId} onDone={() => { setEditing(null); refresh(); }} />
        ) : null}
        {q.isLoading ? (
          <LoadingBlock />
        ) : q.isError ? (
          <ErrorState message="Dishes could not be loaded." onRetry={() => q.refetch()} />
        ) : q.data!.length === 0 && editing !== "new" ? (
          <EmptyState title="No dishes yet" action={<Button onClick={() => setEditing("new")}>Add your first dish</Button>}>
            Students build packs from the dishes you list here.
          </EmptyState>
        ) : (
          <ul className="surface mt-3 divide-y">
            {q.data!.map((d) =>
              editing !== "new" && editing?.id === d.id ? (
                <li key={d.id} className="p-3">
                  <DishForm restaurantId={restaurantId} dish={d} onDone={() => { setEditing(null); refresh(); }} />
                </li>
              ) : (
                <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <p className={d.is_hidden ? "text-muted-foreground line-through" : "font-medium"}>{d.name}</p>
                    {d.description ? <p className="text-sm text-muted-foreground">{d.description}</p> : null}
                    <p className="price text-sm">{formatCents(d.price_cents)}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Switch checked={!d.is_hidden} onCheckedChange={() => toggleHidden(d)} aria-label={`Show ${d.name} to students`} />
                      {d.is_hidden ? "Hidden" : "Visible"}
                    </label>
                    <Button size="sm" variant="ghost" onClick={() => setEditing(d)}>Edit</Button>
                  </div>
                </li>
              ),
            )}
          </ul>
        )}
      </div>
    </section>
  );
}

function DishForm({ restaurantId, dish, onDone }: { restaurantId: string; dish?: Dish; onDone: () => void }) {
  const [name, setName] = useState(dish?.name ?? "");
  const [description, setDescription] = useState(dish?.description ?? "");
  const [price, setPrice] = useState(dish ? (dish.price_cents / 100).toFixed(2) : "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => setError(null), [name, price]);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    const cents = Math.round(Number(price) * 100);
    if (!name.trim()) return setError("Enter a dish name.");
    if (!Number.isFinite(cents) || cents < 50 || cents > 100000) return setError("Enter a price between $0.50 and $1,000.");
    setBusy(true);
    const payload = { name: name.trim().slice(0, 80), description: description.trim().slice(0, 200), price_cents: cents };
    const { error } = dish
      ? await supabase.from("dishes").update(payload).eq("id", dish.id)
      : await supabase.from("dishes").insert({ ...payload, restaurant_id: restaurantId });
    setBusy(false);
    if (error) return setError("Could not save the dish.");
    toast.success(dish ? "Dish updated." : "Dish added.");
    onDone();
  };

  return (
    <form onSubmit={save} noValidate className="surface grid gap-3 bg-panel p-4 sm:grid-cols-[1fr_8rem]">
      <div>
        <Label htmlFor="dish-name">Name</Label>
        <Input id="dish-name" className="mt-1.5 h-11 bg-card" maxLength={80} value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div>
        <Label htmlFor="dish-price">Price ($)</Label>
        <Input id="dish-price" type="number" step="0.01" min="0.5" className="mt-1.5 h-11 bg-card font-mono" value={price} onChange={(e) => setPrice(e.target.value)} />
      </div>
      <div className="sm:col-span-2">
        <Label htmlFor="dish-desc">Short description</Label>
        <Input id="dish-desc" className="mt-1.5 h-11 bg-card" maxLength={200} value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
      <div className="flex items-center gap-2 sm:col-span-2">
        <Button type="submit" disabled={busy}>{busy ? "Saving…" : "Save dish"}</Button>
        <Button type="button" variant="ghost" onClick={onDone}>Cancel</Button>
        <FieldError>{error}</FieldError>
      </div>
    </form>
  );
}
