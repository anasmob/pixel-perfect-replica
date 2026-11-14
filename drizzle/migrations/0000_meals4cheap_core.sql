-- ===== Types =====
create type public.app_role as enum ('student', 'restaurant');
create type public.order_status as enum (
  'pending_payment', 'awaiting_restaurant', 'confirmed', 'ready', 'picked_up', 'declined', 'expired', 'cancelled'
);

-- ===== Roles =====
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;
create policy "Users read own roles" on public.user_roles for select to authenticated using (user_id = auth.uid());

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

-- ===== Profiles =====
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  first_name text not null default '',
  created_at timestamptz not null default now()
);
grant select, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "Users read own profile" on public.profiles for select to authenticated using (id = auth.uid());
create policy "Users update own profile" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- ===== Restaurants (public fields only) =====
create table public.restaurants (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid unique,
  slug text not null unique,
  name text not null,
  cuisine text not null,
  address text not null,
  timezone text not null default 'America/Chicago',
  is_approved boolean not null default false,
  is_demo boolean not null default false,
  discount_percent integer not null default 15 check (discount_percent between 5 and 50),
  min_meals integer not null default 3 check (min_meals >= 1),
  max_meals integer not null default 10 check (max_meals <= 50),
  lead_time_hours integer not null default 12 check (lead_time_hours between 0 and 168),
  created_at timestamptz not null default now(),
  constraint meals_range check (max_meals >= min_meals)
);
grant select on public.restaurants to anon, authenticated;
grant update (discount_percent, min_meals, max_meals, lead_time_hours) on public.restaurants to authenticated;
grant all on public.restaurants to service_role;
alter table public.restaurants enable row level security;
create policy "Approved restaurants are public" on public.restaurants for select to anon, authenticated
  using (is_approved or owner_id = auth.uid());
create policy "Owners update own restaurant" on public.restaurants for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create or replace function public.owns_restaurant(_restaurant_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.restaurants where id = _restaurant_id and owner_id = auth.uid())
$$;

-- Private restaurant data (contact + commission), owner-only read, never writable by restaurant
create table public.restaurant_private (
  restaurant_id uuid primary key references public.restaurants(id) on delete cascade,
  contact_name text not null default '',
  phone text not null default '',
  email text,
  commission_percent numeric(5,2) not null default 10 check (commission_percent between 0 and 100)
);
grant select on public.restaurant_private to authenticated;
grant all on public.restaurant_private to service_role;
alter table public.restaurant_private enable row level security;
create policy "Owners read own private data" on public.restaurant_private for select to authenticated
  using (public.owns_restaurant(restaurant_id));

-- ===== Dishes =====
create table public.dishes (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  description text not null default '' check (char_length(description) <= 200),
  price_cents integer not null check (price_cents between 50 and 100000),
  is_hidden boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index dishes_restaurant_idx on public.dishes(restaurant_id);
grant select on public.dishes to anon, authenticated;
grant insert, update, delete on public.dishes to authenticated;
grant all on public.dishes to service_role;
alter table public.dishes enable row level security;
create policy "Visible dishes of approved restaurants are public" on public.dishes for select to anon, authenticated
  using (
    (not is_hidden and exists (select 1 from public.restaurants r where r.id = restaurant_id and r.is_approved))
    or public.owns_restaurant(restaurant_id)
  );
create policy "Owners insert dishes" on public.dishes for insert to authenticated with check (public.owns_restaurant(restaurant_id));
create policy "Owners update dishes" on public.dishes for update to authenticated using (public.owns_restaurant(restaurant_id)) with check (public.owns_restaurant(restaurant_id));
create policy "Owners delete dishes" on public.dishes for delete to authenticated using (public.owns_restaurant(restaurant_id));

-- ===== Weekly pickup hours (rules) =====
create table public.pickup_hours (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  start_hour smallint not null check (start_hour between 0 and 23),
  end_hour smallint not null check (end_hour between 1 and 24),
  capacity integer not null default 5 check (capacity between 1 and 200),
  created_at timestamptz not null default now(),
  constraint hours_order check (end_hour > start_hour)
);
create index pickup_hours_restaurant_idx on public.pickup_hours(restaurant_id);
grant select, insert, update, delete on public.pickup_hours to authenticated;
grant all on public.pickup_hours to service_role;
alter table public.pickup_hours enable row level security;
create policy "Owners read hours" on public.pickup_hours for select to authenticated using (public.owns_restaurant(restaurant_id));
create policy "Owners insert hours" on public.pickup_hours for insert to authenticated with check (public.owns_restaurant(restaurant_id));
create policy "Owners update hours" on public.pickup_hours for update to authenticated using (public.owns_restaurant(restaurant_id)) with check (public.owns_restaurant(restaurant_id));
create policy "Owners delete hours" on public.pickup_hours for delete to authenticated using (public.owns_restaurant(restaurant_id));

-- ===== Pickup slots (1-hour windows, materialized from hours) =====
create table public.pickup_slots (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  start_time timestamptz not null,
  capacity integer not null check (capacity >= 1),
  unique (restaurant_id, start_time)
);
grant select on public.pickup_slots to anon, authenticated;
grant all on public.pickup_slots to service_role;
alter table public.pickup_slots enable row level security;
create policy "Slots of approved restaurants are public" on public.pickup_slots for select to anon, authenticated
  using (exists (select 1 from public.restaurants r where r.id = restaurant_id and r.is_approved) or public.owns_restaurant(restaurant_id));

-- ===== Orders =====
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  student_id uuid not null,
  student_first_name text not null default '',
  student_email text,
  restaurant_id uuid not null references public.restaurants(id) on delete restrict,
  slot_id uuid not null references public.pickup_slots(id) on delete restrict,
  slot_start timestamptz not null,
  status public.order_status not null default 'pending_payment',
  meal_count integer not null check (meal_count >= 1),
  menu_total_cents integer not null,
  discount_percent integer not null,
  discount_cents integer not null,
  total_cents integer not null,
  stripe_session_id text,
  stripe_payment_intent_id text,
  decline_reason text,
  placed_at timestamptz,
  response_deadline timestamptz,
  confirmed_at timestamptz,
  ready_at timestamptz,
  picked_up_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index orders_student_idx on public.orders(student_id, created_at desc);
create index orders_restaurant_idx on public.orders(restaurant_id, status);
create index orders_slot_idx on public.orders(slot_id);
grant select on public.orders to authenticated;
grant all on public.orders to service_role;
alter table public.orders enable row level security;
create policy "Students read own orders" on public.orders for select to authenticated using (student_id = auth.uid());
create policy "Restaurants read own orders" on public.orders for select to authenticated
  using (public.owns_restaurant(restaurant_id) and status not in ('pending_payment', 'cancelled'));

-- Restaurant-only financials (never visible to students)
create table public.order_financials (
  order_id uuid primary key references public.orders(id) on delete cascade,
  restaurant_id uuid not null references public.restaurants(id) on delete restrict,
  commission_percent numeric(5,2) not null,
  commission_cents integer not null,
  restaurant_payout_cents integer not null,
  payment_captured boolean not null default false,
  created_at timestamptz not null default now()
);
grant select on public.order_financials to authenticated;
grant all on public.order_financials to service_role;
alter table public.order_financials enable row level security;
create policy "Restaurants read own financials" on public.order_financials for select to authenticated
  using (public.owns_restaurant(restaurant_id));

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  dish_id uuid references public.dishes(id) on delete set null,
  dish_name text not null,
  unit_price_cents integer not null,
  quantity integer not null check (quantity >= 1)
);
create index order_items_order_idx on public.order_items(order_id);
grant select on public.order_items to authenticated;
grant all on public.order_items to service_role;
alter table public.order_items enable row level security;
create policy "Read items of visible orders" on public.order_items for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id));

-- ===== Slot helpers =====
create or replace function public.active_order_count(_slot_id uuid)
returns integer language sql stable security definer set search_path = public as $$
  select count(*)::int from public.orders o
  where o.slot_id = _slot_id
    and (o.status in ('awaiting_restaurant', 'confirmed', 'ready', 'picked_up')
         or (o.status = 'pending_payment' and o.created_at > now() - interval '35 minutes'))
$$;
revoke execute on function public.active_order_count(uuid) from public, anon, authenticated;

-- Bookable slots for an approved restaurant (respects lead time and capacity)
create or replace function public.available_slots(_restaurant_id uuid)
returns table (slot_id uuid, start_time timestamptz, capacity integer, remaining integer)
language sql stable security definer set search_path = public as $$
  select s.id, s.start_time, s.capacity, (s.capacity - public.active_order_count(s.id)) as remaining
  from public.pickup_slots s
  join public.restaurants r on r.id = s.restaurant_id
  where s.restaurant_id = _restaurant_id
    and r.is_approved
    and s.start_time >= now() + make_interval(hours => r.lead_time_hours)
    and s.capacity - public.active_order_count(s.id) > 0
  order by s.start_time
$$;
grant execute on function public.available_slots(uuid) to anon, authenticated;

-- Restaurant cards with next available slot
create or replace function public.restaurant_cards()
returns table (
  id uuid, slug text, name text, cuisine text, address text, timezone text, is_demo boolean,
  discount_percent integer, min_meals integer, max_meals integer, next_slot timestamptz
)
language sql stable security definer set search_path = public as $$
  select r.id, r.slug, r.name, r.cuisine, r.address, r.timezone, r.is_demo,
         r.discount_percent, r.min_meals, r.max_meals,
         (select min(s.start_time) from public.pickup_slots s
           where s.restaurant_id = r.id
             and s.start_time >= now() + make_interval(hours => r.lead_time_hours)
             and s.capacity - public.active_order_count(s.id) > 0) as next_slot
  from public.restaurants r
  where r.is_approved
  order by r.is_demo, r.name
$$;
grant execute on function public.restaurant_cards() to anon, authenticated;

-- Regenerate slots for the next 7 days from weekly hours (restaurant local time)
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
  delete from _wanted_slots;

  insert into _wanted_slots (start_ts, capacity)
  select ((d.day + make_time(h, 0, 0)) at time zone v_tz) as start_ts, max(ph.capacity)
  from (select ((now() at time zone v_tz)::date + g) as day from generate_series(0, 7) g) d
  join public.pickup_hours ph on ph.restaurant_id = _restaurant_id and ph.weekday = extract(dow from d.day)
  cross join lateral generate_series(ph.start_hour::int, ph.end_hour::int - 1) h
  group by 1
  having ((min(d.day) + make_time(min(h), 0, 0)) at time zone v_tz) > now();

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
revoke execute on function public.regenerate_slots(uuid) from public, anon;
grant execute on function public.regenerate_slots(uuid) to authenticated;

create or replace function public.regenerate_all_slots()
returns void language plpgsql security definer set search_path = public as $$
declare r record;
begin
  for r in select id from public.restaurants loop
    perform public.regenerate_slots(r.id);
  end loop;
end;
$$;
revoke execute on function public.regenerate_all_slots() from public, anon, authenticated;

-- ===== Signup trigger =====
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_role text := coalesce(new.raw_user_meta_data->>'role', 'student');
  v_meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_name text;
  v_tz text;
  v_rid uuid;
  v_slug text;
begin
  if v_role not in ('student', 'restaurant') then
    v_role := 'student';
  end if;

  if v_role = 'student' and lower(coalesce(new.email, '')) !~ '\.edu$' then
    raise exception 'Students must sign up with a .edu email address';
  end if;

  insert into public.profiles (id, first_name)
  values (new.id, left(trim(coalesce(v_meta->>'first_name', v_meta->>'contact_name', '')), 60));

  insert into public.user_roles (user_id, role) values (new.id, v_role::public.app_role);

  if v_role = 'restaurant' then
    v_name := left(trim(coalesce(v_meta->>'restaurant_name', '')), 80);
    if v_name = '' then raise exception 'Restaurant name is required'; end if;
    v_tz := coalesce(v_meta->>'timezone', 'America/Chicago');
    if not exists (select 1 from pg_timezone_names where name = v_tz) then
      v_tz := 'America/Chicago';
    end if;
    v_slug := trim(both '-' from lower(regexp_replace(v_name, '[^a-zA-Z0-9]+', '-', 'g')));
    if v_slug = '' then v_slug := 'restaurant'; end if;
    v_slug := v_slug || '-' || substr(md5(random()::text), 1, 5);

    insert into public.restaurants (owner_id, slug, name, cuisine, address, timezone)
    values (new.id, v_slug, v_name,
            left(trim(coalesce(v_meta->>'cuisine', '')), 60),
            left(trim(coalesce(v_meta->>'address', '')), 200),
            v_tz)
    returning id into v_rid;

    insert into public.restaurant_private (restaurant_id, contact_name, phone, email)
    values (v_rid,
            left(trim(coalesce(v_meta->>'contact_name', '')), 80),
            left(trim(coalesce(v_meta->>'phone', '')), 40),
            new.email);
  end if;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- updated_at
create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at := now(); return new; end;
$$;
create trigger orders_touch before update on public.orders for each row execute function public.touch_updated_at();

-- ===== Demo data (is_demo = true; delete with: delete from restaurants where is_demo) =====
insert into public.restaurants (id, slug, name, cuisine, address, timezone, is_approved, is_demo, discount_percent, min_meals, max_meals, lead_time_hours)
values
  ('11111111-1111-4111-8111-111111111111', 'demo-green-bowl-kitchen', 'Green Bowl Kitchen', 'Grain bowls', 'Demo address, not a real location', 'America/Chicago', true, true, 15, 3, 8, 12),
  ('22222222-2222-4222-8222-222222222222', 'demo-casa-pilar', 'Casa Pilar', 'Mexican', 'Demo address, not a real location', 'America/Chicago', true, true, 25, 4, 10, 12),
  ('33333333-3333-4333-8333-333333333333', 'demo-lotus-curry-house', 'Lotus Curry House', 'Indian', 'Demo address, not a real location', 'America/Chicago', true, true, 35, 5, 12, 12);

insert into public.restaurant_private (restaurant_id, contact_name, phone, email, commission_percent) values
  ('11111111-1111-4111-8111-111111111111', 'Demo', '', null, 10),
  ('22222222-2222-4222-8222-222222222222', 'Demo', '', null, 10),
  ('33333333-3333-4333-8333-333333333333', 'Demo', '', null, 10);

insert into public.dishes (restaurant_id, name, description, price_cents, sort_order) values
  ('11111111-1111-4111-8111-111111111111', 'Chicken teriyaki bowl', 'Brown rice, grilled chicken, broccoli, sesame.', 1150, 1),
  ('11111111-1111-4111-8111-111111111111', 'Falafel quinoa bowl', 'Quinoa, falafel, cucumber, tahini.', 1075, 2),
  ('11111111-1111-4111-8111-111111111111', 'Salmon poke bowl', 'Sushi rice, salmon, edamame, avocado.', 1325, 3),
  ('11111111-1111-4111-8111-111111111111', 'Tofu peanut bowl', 'Rice noodles, crispy tofu, peanut sauce.', 1025, 4),
  ('22222222-2222-4222-8222-222222222222', 'Chicken burrito', 'Rice, black beans, pico, cheese.', 1095, 1),
  ('22222222-2222-4222-8222-222222222222', 'Carnitas rice bowl', 'Slow-cooked pork, rice, salsa verde.', 1195, 2),
  ('22222222-2222-4222-8222-222222222222', 'Veggie enchiladas', 'Two enchiladas, red sauce, beans.', 1050, 3),
  ('22222222-2222-4222-8222-222222222222', 'Steak tacos (3)', 'Grilled steak, onion, cilantro, lime.', 1250, 4),
  ('33333333-3333-4333-8333-333333333333', 'Butter chicken with rice', 'Creamy tomato sauce, basmati rice.', 1295, 1),
  ('33333333-3333-4333-8333-333333333333', 'Chana masala', 'Spiced chickpeas, basmati rice.', 1095, 2),
  ('33333333-3333-4333-8333-333333333333', 'Lamb rogan josh', 'Braised lamb, basmati rice.', 1450, 3),
  ('33333333-3333-4333-8333-333333333333', 'Paneer tikka masala', 'Grilled paneer, basmati rice.', 1250, 4);

insert into public.pickup_hours (restaurant_id, weekday, start_hour, end_hour, capacity)
select r.id, wd, h.s, h.e, h.c
from (values
  ('11111111-1111-4111-8111-111111111111'::uuid),
  ('22222222-2222-4222-8222-222222222222'::uuid),
  ('33333333-3333-4333-8333-333333333333'::uuid)) as r(id)
cross join generate_series(0, 6) wd
cross join (values (11::smallint, 14::smallint, 6), (17::smallint, 20::smallint, 6)) as h(s, e, c);

select public.regenerate_slots('11111111-1111-4111-8111-111111111111');
select public.regenerate_slots('22222222-2222-4222-8222-222222222222');
select public.regenerate_slots('33333333-3333-4333-8333-333333333333');
