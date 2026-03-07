-- Migration 010: Reporting views

-- Daily occupancy per office
create or replace view public.v_daily_occupancy as
select
  o.id as office_id,
  o.name as office_name,
  b.booking_date,
  count(distinct b.id) filter (where b.status in ('confirmed', 'completed') and wa.asset_type = 'desk') as desks_booked,
  count(distinct wa.id) filter (where wa.asset_type = 'desk' and wa.status = 'available' and wa.is_draft = false) as desks_total,
  count(distinct b.id) filter (where b.status in ('confirmed', 'completed') and wa.asset_type = 'room') as rooms_booked,
  count(distinct wa.id) filter (where wa.asset_type = 'room' and wa.status = 'available' and wa.is_draft = false) as rooms_total
from public.offices o
left join public.floors f on f.office_id = o.id
left join public.workspace_assets wa on wa.floor_id = f.id
left join public.bookings b on b.asset_id = wa.id
group by o.id, o.name, b.booking_date;

-- Weekly booking count by office
create or replace view public.v_weekly_occupancy as
select
  o.id as office_id,
  o.name as office_name,
  date_trunc('week', b.booking_date) as week_start,
  count(distinct b.id) filter (where wa.asset_type = 'desk' and b.status in ('confirmed', 'completed')) as desk_bookings,
  count(distinct b.id) filter (where wa.asset_type = 'room' and b.status in ('confirmed', 'completed')) as room_bookings,
  count(distinct b.user_id) as unique_attendees
from public.offices o
left join public.floors f on f.office_id = o.id
left join public.workspace_assets wa on wa.floor_id = f.id
left join public.bookings b on b.asset_id = wa.id
group by o.id, o.name, week_start;

-- Team attendance by day
create or replace view public.v_team_attendance as
select
  t.id as team_id,
  t.name as team_name,
  ap.work_date,
  u.id as user_id,
  u.first_name || ' ' || u.last_name as user_name,
  ap.plan_status,
  ap.linked_booking_id
from public.teams t
join public.users u on u.team_id = t.id
left join public.attendance_plans ap on ap.user_id = u.id
where u.status = 'active';

-- Asset utilisation (last 30 days)
create or replace view public.v_utilisation as
select
  wa.id as asset_id,
  wa.code,
  wa.name,
  wa.asset_type,
  f.name as floor_name,
  o.name as office_name,
  count(b.id) as total_bookings,
  count(b.id) filter (where b.booking_date >= current_date - 30) as bookings_last_30d,
  round(
    100.0 * count(b.id) filter (where b.booking_date >= current_date - 30) / 30, 1
  ) as utilisation_pct_30d
from public.workspace_assets wa
join public.floors f on f.id = wa.floor_id
join public.offices o on o.id = f.office_id
left join public.bookings b on b.asset_id = wa.id and b.status in ('confirmed', 'completed')
where wa.is_draft = false
group by wa.id, wa.code, wa.name, wa.asset_type, f.name, o.name;

-- RLS: views inherit permissions via underlying table RLS
-- Grant read to authenticated users for own-org data (enforced via underlying tables)
