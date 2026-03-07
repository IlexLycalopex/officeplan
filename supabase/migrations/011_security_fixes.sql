-- Migration 011: Security fixes
-- Fix set_updated_at to use fixed search_path
create or replace function public.set_updated_at()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Recreate reporting views with security_invoker so they respect the calling user's RLS
drop view if exists public.v_daily_occupancy;
drop view if exists public.v_weekly_occupancy;
drop view if exists public.v_team_attendance;
drop view if exists public.v_utilisation;

create view public.v_daily_occupancy with (security_invoker = true) as
select
  o.id as office_id, o.name as office_name, b.booking_date,
  count(distinct b.id) filter (where b.status in ('confirmed','completed') and wa.asset_type='desk') as desks_booked,
  count(distinct wa.id) filter (where wa.asset_type='desk' and wa.status='available' and wa.is_draft=false) as desks_total,
  count(distinct b.id) filter (where b.status in ('confirmed','completed') and wa.asset_type='room') as rooms_booked,
  count(distinct wa.id) filter (where wa.asset_type='room' and wa.status='available' and wa.is_draft=false) as rooms_total
from public.offices o
left join public.floors f on f.office_id = o.id
left join public.workspace_assets wa on wa.floor_id = f.id
left join public.bookings b on b.asset_id = wa.id
group by o.id, o.name, b.booking_date;

create view public.v_weekly_occupancy with (security_invoker = true) as
select
  o.id as office_id, o.name as office_name,
  date_trunc('week', b.booking_date) as week_start,
  count(distinct b.id) filter (where wa.asset_type='desk' and b.status in ('confirmed','completed')) as desk_bookings,
  count(distinct b.id) filter (where wa.asset_type='room' and b.status in ('confirmed','completed')) as room_bookings,
  count(distinct b.user_id) as unique_attendees
from public.offices o
left join public.floors f on f.office_id = o.id
left join public.workspace_assets wa on wa.floor_id = f.id
left join public.bookings b on b.asset_id = wa.id
group by o.id, o.name, week_start;

create view public.v_team_attendance with (security_invoker = true) as
select t.id as team_id, t.name as team_name, ap.work_date,
  u.id as user_id, u.first_name || ' ' || u.last_name as user_name,
  ap.plan_status, ap.linked_booking_id
from public.teams t
join public.users u on u.team_id = t.id
left join public.attendance_plans ap on ap.user_id = u.id
where u.status = 'active';

create view public.v_utilisation with (security_invoker = true) as
select wa.id as asset_id, wa.code, wa.name, wa.asset_type,
  f.name as floor_name, o.name as office_name,
  count(b.id) as total_bookings,
  count(b.id) filter (where b.booking_date >= current_date - 30) as bookings_last_30d,
  round(100.0 * count(b.id) filter (where b.booking_date >= current_date - 30) / nullif(30,0), 1) as utilisation_pct_30d
from public.workspace_assets wa
join public.floors f on f.id = wa.floor_id
join public.offices o on o.id = f.office_id
left join public.bookings b on b.asset_id = wa.id and b.status in ('confirmed','completed')
where wa.is_draft = false
group by wa.id, wa.code, wa.name, wa.asset_type, f.name, o.name;
