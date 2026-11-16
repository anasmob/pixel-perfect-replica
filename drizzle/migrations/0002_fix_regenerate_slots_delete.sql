create or replace function public.regenerate_slots(_restaurant_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_tz text;
  v_role text := coalesce(auth.role(), '');
begin
  if v_role not in ('', 'service_role') and not public.owns_restaurant(_restaurant_id) then
    raise exception 'Not allowed';
  end if;
  select timezone into v_tz from public.restaurants where id = _restaurant_id;
  if v_tz is null then return; end if;

  create temp table if not exists _wanted_slots (start_ts timestamptz primary key, capacity integer) on commit drop;
  delete from _wanted_slots where true;

  insert into _wanted_slots (start_ts, capacity)
  select ((d.day + make_time(h, 0, 0)) at time zone v_tz) as start_ts, max(ph.capacity)
  from (select ((now() at time zone v_tz)::date + g) as day from generate_series(0, 7) g) d
  join public.pickup_hours ph on ph.restaurant_id = _restaurant_id and ph.weekday = extract(dow from d.day)
  cross join lateral generate_series(ph.start_hour::int, ph.end_hour::int - 1) h
  group by 1;

  delete from public.pickup_slots s
  where s.restaurant_id = _restaurant_id
    and s.start_time > now()
    and not exists (select 1 from _wanted_slots w where w.start_ts = s.start_time)
    and not exists (select 1 from public.orders o where o.slot_id = s.id);

  insert into public.pickup_slots (restaurant_id, start_time, capacity)
  select _restaurant_id, w.start_ts, w.capacity from _wanted_slots w where w.start_ts > now()
  on conflict (restaurant_id, start_time) do update set capacity = excluded.capacity;
end;
$$;
