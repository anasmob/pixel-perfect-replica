import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ErrorState, LoadingBlock } from "@/components/site/States";
import { FieldError } from "@/components/site/AuthCard";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { myRestaurantQuery } from "@/lib/dashboard-queries";
import { dayKey, formatDay, formatTime } from "@/lib/time";

export const Route = createFileRoute("/_authenticated/dashboard/slots")({
  component: SlotsTab,
});

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const ORDERED_DAYS = [1, 2, 3, 4, 5, 6, 0];

interface Row {
  key: string;
  weekday: number;
  start_hour: number;
  end_hour: number;
  capacity: number;
}

const hourLabel = (h: number) => {
  if (h === 0 || h === 24) return "12 AM";
  if (h === 12) return "12 PM";
  return h < 12 ? `${h} AM` : `${h - 12} PM`;
};

function SlotsTab() {
  const { session } = useAuth();
  const rq = useQuery(myRestaurantQuery(session?.user.id));
  const r = rq.data;
  const qc = useQueryClient();

  const hq = useQuery({
    queryKey: ["my-hours", r?.id],
    enabled: !!r?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pickup_hours")
        .select("id, weekday, start_hour, end_hour, capacity")
        .eq("restaurant_id", r!.id)
        .order("weekday")
        .order("start_hour");
      if (error) throw error;
      return data;
    },
  });

  const slotsQ = useQuery({
    queryKey: ["my-slots", r?.id],
    enabled: !!r?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pickup_slots")
        .select("id, start_time, capacity")
        .eq("restaurant_id", r!.id)
        .gte("start_time", new Date().toISOString())
        .order("start_time")
        .limit(500);
      if (error) throw error;
      return data;
    },
  });

  const [rows, setRows] = useState<Row[]>([]);
  const [lead, setLead] = useState("12");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (hq.data) setRows(hq.data.map((h) => ({ key: h.id, ...h })));
  }, [hq.data]);
  useEffect(() => {
    if (r) setLead(String(r.lead_time_hours));
  }, [r]);

  if (!r || hq.isLoading) return <LoadingBlock />;
  if (hq.isError) return <ErrorState message="Pickup hours could not be loaded." onRetry={() => hq.refetch()} />;

  const addRow = (weekday: number) =>
    setRows([...rows, { key: crypto.randomUUID(), weekday, start_hour: 11, end_hour: 14, capacity: 5 }]);
  const patch = (key: string, p: Partial<Row>) => setRows(rows.map((x) => (x.key === key ? { ...x, ...p } : x)));

  const save = async () => {
    const leadNum = Number(lead);
    if (!Number.isInteger(leadNum) || leadNum < 0 || leadNum > 168) return setError("Lead time must be 0 to 168 hours.");
    for (const x of rows) {
      if (x.end_hour <= x.start_hour) return setError(`${WEEKDAYS[x.weekday]}: end time must be after start time.`);
      if (!Number.isInteger(x.capacity) || x.capacity < 1 || x.capacity > 200) return setError(`${WEEKDAYS[x.weekday]}: max orders must be 1 to 200.`);
    }
    for (const d of ORDERED_DAYS) {
      const day = rows.filter((x) => x.weekday === d).sort((a, b) => a.start_hour - b.start_hour);
      for (let i = 1; i < day.length; i++) {
        if (day[i]!.start_hour < day[i - 1]!.end_hour) return setError(`${WEEKDAYS[d]}: hours overlap.`);
      }
    }
    setError(null);
    setBusy(true);
    try {
      const { error: e1 } = await supabase.from("restaurants").update({ lead_time_hours: leadNum }).eq("id", r.id);
      if (e1) throw e1;
      const { error: e2 } = await supabase.from("pickup_hours").delete().eq("restaurant_id", r.id);
      if (e2) throw e2;
      if (rows.length) {
        const { error: e3 } = await supabase.from("pickup_hours").insert(
          rows.map((x) => ({ restaurant_id: r.id, weekday: x.weekday, start_hour: x.start_hour, end_hour: x.end_hour, capacity: x.capacity })),
        );
        if (e3) throw e3;
      }
      const { error: e4 } = await supabase.rpc("regenerate_slots", { _restaurant_id: r.id });
      if (e4) throw e4;
      toast.success("Pickup hours saved. Slots for the next 7 days are updated.");
      qc.invalidateQueries({ queryKey: ["my-hours"] });
      qc.invalidateQueries({ queryKey: ["my-slots"] });
      qc.invalidateQueries({ queryKey: ["my-restaurant"] });
      qc.invalidateQueries({ queryKey: ["restaurants"] });
    } catch (e) {
      console.error(e);
      setError("Could not save pickup hours. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const byDay = new Map<string, { label: string; times: { id: string; label: string; capacity: number }[] }>();
  for (const s of slotsQ.data ?? []) {
    const k = dayKey(s.start_time, r.timezone);
    if (!byDay.has(k)) byDay.set(k, { label: formatDay(s.start_time, r.timezone), times: [] });
    byDay.get(k)!.times.push({ id: s.id, label: formatTime(s.start_time, r.timezone), capacity: s.capacity });
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
      <section className="space-y-4">
        <div className="surface space-y-3 p-5">
          <h2 className="text-lg font-semibold">Weekly pickup hours</h2>
          <p className="text-sm text-muted-foreground">
            Each range is split into 1-hour pickup slots. Max orders applies to each slot. Times use {r.timezone.replace("_", " ")}.
          </p>
          <div className="divide-y">
            {ORDERED_DAYS.map((d) => {
              const dayRows = rows.filter((x) => x.weekday === d);
              return (
                <div key={d} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-start">
                  <div className="w-28 pt-2 text-sm font-medium">{WEEKDAYS[d]}</div>
                  <div className="flex-1 space-y-2">
                    {dayRows.length === 0 ? <p className="pt-2 text-sm text-muted-foreground">Closed for pickup</p> : null}
                    {dayRows.map((x) => (
                      <div key={x.key} className="flex flex-wrap items-center gap-2 text-sm">
                        <HourSelect label="From" value={x.start_hour} min={0} max={23} onChange={(v) => patch(x.key, { start_hour: v })} />
                        <span className="text-muted-foreground">to</span>
                        <HourSelect label="To" value={x.end_hour} min={1} max={24} onChange={(v) => patch(x.key, { end_hour: v })} />
                        <label className="flex items-center gap-2">
                          <span className="text-muted-foreground">Max orders</span>
                          <Input
                            type="number"
                            min={1}
                            max={200}
                            className="h-10 w-20 font-mono"
                            value={x.capacity}
                            onChange={(e) => patch(x.key, { capacity: Math.floor(Number(e.target.value)) })}
                          />
                        </label>
                        <Button variant="ghost" size="icon" aria-label="Remove hours" onClick={() => setRows(rows.filter((y) => y.key !== x.key))}>
                          <Trash2 />
                        </Button>
                      </div>
                    ))}
                    <Button variant="ghost" size="sm" onClick={() => addRow(d)}>
                      <Plus /> Add hours
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="surface flex flex-wrap items-end gap-4 p-5">
          <div>
            <Label htmlFor="lead">Lead time (hours)</Label>
            <Input id="lead" type="number" min={0} max={168} className="mt-1.5 h-11 w-28 font-mono" value={lead} onChange={(e) => setLead(e.target.value)} />
          </div>
          <p className="max-w-sm text-sm text-muted-foreground">Students can't book a slot that starts sooner than this.</p>
        </div>

        <div className="flex items-center gap-3">
          <Button onClick={save} disabled={busy}>{busy ? "Saving…" : "Save pickup hours"}</Button>
          <FieldError>{error}</FieldError>
        </div>
      </section>

      <aside className="surface h-fit p-5">
        <h2 className="text-lg font-semibold">Upcoming slots</h2>
        <p className="mt-1 text-sm text-muted-foreground">Next 7 days.</p>
        <div className="mt-4 space-y-4 font-mono text-xs">
          {slotsQ.isLoading ? (
            <p className="text-muted-foreground">Loading…</p>
          ) : byDay.size === 0 ? (
            <p className="font-sans text-sm text-muted-foreground">No slots yet. Add pickup hours and save.</p>
          ) : (
            [...byDay.values()].map((d) => (
              <div key={d.label}>
                <p className="font-sans text-sm font-medium">{d.label}</p>
                <ul className="mt-1 space-y-0.5 text-muted-foreground">
                  {d.times.map((t) => (
                    <li key={t.id} className="flex justify-between"><span>{t.label}</span><span>max {t.capacity}</span></li>
                  ))}
                </ul>
              </div>
            ))
          )}
        </div>
      </aside>
    </div>
  );
}

function HourSelect({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="h-10 rounded-lg border bg-card px-2 font-mono text-sm"
    >
      {Array.from({ length: max - min + 1 }, (_, i) => min + i).map((h) => (
        <option key={h} value={h}>{hourLabel(h)}</option>
      ))}
    </select>
  );
}
