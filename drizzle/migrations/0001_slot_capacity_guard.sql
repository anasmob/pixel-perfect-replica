grant execute on function public.active_order_count(uuid) to service_role;
grant execute on function public.regenerate_all_slots() to service_role;

create or replace function public.enforce_slot_capacity()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_cap integer;
  v_rid uuid;
  v_count integer;
begin
  select capacity, restaurant_id into v_cap, v_rid from public.pickup_slots where id = new.slot_id for update;
  if v_cap is null then
    raise exception 'SLOT_NOT_FOUND';
  end if;
  if v_rid <> new.restaurant_id then
    raise exception 'SLOT_MISMATCH';
  end if;
  select count(*) into v_count from public.orders o
  where o.slot_id = new.slot_id
    and (o.status in ('awaiting_restaurant', 'confirmed', 'ready', 'picked_up')
         or (o.status = 'pending_payment' and o.created_at > now() - interval '35 minutes'));
  if v_count >= v_cap then
    raise exception 'SLOT_FULL';
  end if;
  return new;
end;
$$;

create trigger orders_slot_capacity
  before insert on public.orders
  for each row execute function public.enforce_slot_capacity();
