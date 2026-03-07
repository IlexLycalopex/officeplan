-- Migration 005: Bookings

create type public.booking_status as enum (
  'confirmed', 'pending_approval', 'cancelled', 'rejected', 'completed'
);

create type public.booking_source as enum ('user', 'admin', 'recurring', 'import');

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.workspace_assets(id) on delete restrict,
  user_id uuid not null references public.users(id) on delete cascade,
  booking_date date not null,
  -- For desk bookings start/end cover the working day (null = whole day)
  start_time time,
  end_time time,
  status public.booking_status not null default 'confirmed',
  source public.booking_source not null default 'user',
  notes text,
  cancelled_at timestamptz,
  cancelled_by_user_id uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_bookings_asset_date on public.bookings(asset_id, booking_date);
create index idx_bookings_user on public.bookings(user_id);
create index idx_bookings_date on public.bookings(booking_date);
create index idx_bookings_status on public.bookings(status);

-- RLS
alter table public.bookings enable row level security;

create policy "bookings: select own"
  on public.bookings for select to authenticated
  using (
    user_id in (select id from public.users where auth_user_id = auth.uid())
  );

create policy "bookings: select team (manager)"
  on public.bookings for select to authenticated
  using (
    user_id in (
      select u.id from public.users u
      join public.users me on me.auth_user_id = auth.uid()
      where u.team_id in (
        select t.id from public.teams t where t.manager_user_id = me.id
      )
      or me.role in ('admin', 'system_admin')
    )
  );

create policy "bookings: insert own within policy"
  on public.bookings for insert to authenticated
  with check (
    user_id in (select id from public.users where auth_user_id = auth.uid())
  );

create policy "bookings: update own"
  on public.bookings for update to authenticated
  using (
    user_id in (select id from public.users where auth_user_id = auth.uid())
  );

create policy "bookings: admin all"
  on public.bookings for all to authenticated
  using (
    asset_id in (
      select wa.id from public.workspace_assets wa
      join public.floors f on f.id = wa.floor_id
      join public.offices o on o.id = f.office_id
      join public.users u on u.organisation_id = o.organisation_id
      where u.auth_user_id = auth.uid()
        and u.role in ('admin', 'system_admin')
    )
  );

-- Core booking RPC — enforces all policy rules server-side
create or replace function public.fn_create_booking(
  p_asset_id uuid,
  p_user_id uuid,
  p_booking_date date,
  p_start_time time default null,
  p_end_time time default null,
  p_notes text default null
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_asset workspace_assets%rowtype;
  v_days_ahead integer;
  v_self_book_window integer := 14;   -- configurable via policies table (phase 2)
  v_max_window integer := 180;
  v_status booking_status;
  v_booking_id uuid;
  v_conflict_count integer;
  v_me users%rowtype;
begin
  -- Load caller's profile
  select * into v_me from public.users where auth_user_id = auth.uid();
  if not found then
    return jsonb_build_object('error', 'User profile not found');
  end if;

  -- Load asset
  select * into v_asset from public.workspace_assets where id = p_asset_id and is_draft = false;
  if not found then
    return jsonb_build_object('error', 'Asset not found or not published');
  end if;

  -- Status check
  if v_asset.status not in ('available', 'restricted') then
    return jsonb_build_object('error', 'Asset is not available for booking');
  end if;

  -- Restriction check
  if v_asset.restriction_type = 'named_user' and v_asset.restricted_user_id != p_user_id then
    return jsonb_build_object('error', 'This desk is reserved for another person');
  end if;
  if v_asset.restriction_type = 'team' then
    if not exists (
      select 1 from public.users where id = p_user_id and team_id = v_asset.restricted_team_id
    ) then
      return jsonb_build_object('error', 'This desk is reserved for a specific team');
    end if;
  end if;
  if v_asset.restriction_type = 'admin_only' and v_me.role not in ('admin', 'system_admin') then
    return jsonb_build_object('error', 'This desk requires admin allocation');
  end if;

  -- Booking window
  v_days_ahead := (p_booking_date - current_date)::integer;
  if v_days_ahead < 0 then
    return jsonb_build_object('error', 'Cannot book in the past');
  end if;
  if v_days_ahead > v_max_window then
    return jsonb_build_object('error', 'Booking date is beyond the maximum booking window');
  end if;

  -- Conflict: asset already booked for this date
  select count(*) into v_conflict_count
  from public.bookings
  where asset_id = p_asset_id
    and booking_date = p_booking_date
    and status in ('confirmed', 'pending_approval')
    and (
      p_start_time is null or start_time is null
      or (start_time, end_time) overlaps (p_start_time, p_end_time)
    );
  if v_conflict_count > 0 then
    return jsonb_build_object('error', 'This desk is already booked for the selected date/time');
  end if;

  -- Self-conflict: user cannot hold two desk bookings same day
  if v_asset.asset_type = 'desk' then
    select count(*) into v_conflict_count
    from public.bookings b
    join public.workspace_assets wa on wa.id = b.asset_id
    where b.user_id = p_user_id
      and b.booking_date = p_booking_date
      and b.status in ('confirmed', 'pending_approval')
      and wa.asset_type = 'desk';
    if v_conflict_count > 0 then
      return jsonb_build_object('error', 'You already have a desk booking on this date');
    end if;
  end if;

  -- Determine status
  if v_days_ahead <= v_self_book_window then
    v_status := 'confirmed';
  else
    v_status := 'pending_approval';
  end if;

  -- Insert booking
  insert into public.bookings (
    asset_id, user_id, booking_date, start_time, end_time, status, notes
  )
  values (
    p_asset_id, p_user_id, p_booking_date, p_start_time, p_end_time, v_status, p_notes
  )
  returning id into v_booking_id;

  -- Create approval request if needed
  if v_status = 'pending_approval' then
    insert into public.approval_requests (
      request_type, target_booking_id, requester_user_id, status
    )
    values ('advance_booking', v_booking_id, p_user_id, 'pending');
  end if;

  -- Audit
  insert into public.audit_events (
    actor_user_id, entity_type, entity_id, action_type, payload_json
  )
  values (
    v_me.id, 'booking', v_booking_id, 'created',
    jsonb_build_object('status', v_status, 'date', p_booking_date, 'asset_id', p_asset_id)
  );

  return jsonb_build_object('booking_id', v_booking_id, 'status', v_status);
end;
$$;

-- Cancel booking RPC
create or replace function public.fn_cancel_booking(p_booking_id uuid, p_reason text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_booking bookings%rowtype;
  v_me users%rowtype;
begin
  select * into v_me from public.users where auth_user_id = auth.uid();
  select * into v_booking from public.bookings where id = p_booking_id;

  if not found then
    return jsonb_build_object('error', 'Booking not found');
  end if;

  if v_booking.user_id != v_me.id and v_me.role not in ('admin', 'system_admin') then
    return jsonb_build_object('error', 'Not authorised to cancel this booking');
  end if;

  if v_booking.status in ('cancelled', 'rejected', 'completed') then
    return jsonb_build_object('error', 'Booking cannot be cancelled in its current state');
  end if;

  update public.bookings
  set status = 'cancelled', cancelled_at = now(), cancelled_by_user_id = v_me.id, updated_at = now()
  where id = p_booking_id;

  insert into public.audit_events (actor_user_id, entity_type, entity_id, action_type, payload_json)
  values (v_me.id, 'booking', p_booking_id, 'cancelled',
    jsonb_build_object('reason', p_reason, 'date', v_booking.booking_date));

  return jsonb_build_object('success', true);
end;
$$;

create trigger bookings_updated_at before update on public.bookings
  for each row execute function public.set_updated_at();
