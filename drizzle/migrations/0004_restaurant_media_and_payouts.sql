alter table public.restaurants
  add column logo_url text check (logo_url is null or logo_url ~ '^/api/public/media/[A-Za-z0-9/._-]{1,200}$'),
  add column cover_url text check (cover_url is null or cover_url ~ '^/api/public/media/[A-Za-z0-9/._-]{1,200}$');
grant update (logo_url, cover_url) on public.restaurants to authenticated;

alter table public.restaurant_private
  add column stripe_account_id text,
  add column stripe_details_submitted boolean not null default false,
  add column stripe_payouts_ready boolean not null default false;

alter table public.order_financials
  add column transfer_destination text;

drop function if exists public.restaurant_cards();
create function public.restaurant_cards()
returns table (
  id uuid, slug text, name text, cuisine text, address text, timezone text, is_demo boolean,
  discount_percent integer, min_meals integer, max_meals integer, logo_url text, cover_url text, next_slot timestamptz
)
language sql stable security definer set search_path = public as $$
  select r.id, r.slug, r.name, r.cuisine, r.address, r.timezone, r.is_demo,
         r.discount_percent, r.min_meals, r.max_meals, r.logo_url, r.cover_url,
         (select min(s.start_time) from public.pickup_slots s
           where s.restaurant_id = r.id
             and s.start_time >= now() + make_interval(hours => r.lead_time_hours)
             and s.capacity - public.active_order_count(s.id) > 0) as next_slot
  from public.restaurants r
  where r.is_approved
  order by r.is_demo, r.name
$$;
revoke execute on function public.restaurant_cards() from public;
grant execute on function public.restaurant_cards() to anon, authenticated, service_role;

create or replace function public.owns_media_folder(_name text)
returns boolean language sql stable security definer set search_path = public as $$
  select case
    when (storage.foldername(_name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then public.owns_restaurant(((storage.foldername(_name))[1])::uuid)
    else false
  end
$$;
revoke execute on function public.owns_media_folder(text) from public, anon;
grant execute on function public.owns_media_folder(text) to authenticated;

create policy "Restaurant media is viewable" on storage.objects for select to anon, authenticated
  using (bucket_id = 'restaurant-media');
create policy "Owners upload own media" on storage.objects for insert to authenticated
  with check (bucket_id = 'restaurant-media' and public.owns_media_folder(name));
create policy "Owners update own media" on storage.objects for update to authenticated
  using (bucket_id = 'restaurant-media' and public.owns_media_folder(name))
  with check (bucket_id = 'restaurant-media' and public.owns_media_folder(name));
create policy "Owners delete own media" on storage.objects for delete to authenticated
  using (bucket_id = 'restaurant-media' and public.owns_media_folder(name));

update public.restaurants set logo_url = '/api/public/media/demo/logo-green-bowl.jpg', cover_url = '/api/public/media/demo/cover-green-bowl.jpg'
  where id = '11111111-1111-4111-8111-111111111111';
update public.restaurants set logo_url = '/api/public/media/demo/logo-casa-pilar.jpg', cover_url = '/api/public/media/demo/cover-casa-pilar.jpg'
  where id = '22222222-2222-4222-8222-222222222222';
update public.restaurants set logo_url = '/api/public/media/demo/logo-lotus-curry.jpg', cover_url = '/api/public/media/demo/cover-lotus-curry.jpg'
  where id = '33333333-3333-4333-8333-333333333333';