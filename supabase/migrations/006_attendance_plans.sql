-- Migration 006: Attendance Plans (weekly rota)

create type public.plan_status as enum (
  'in_office', 'remote', 'leave', 'unavailable', 'unplanned'
);

create table public.attendance_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  work_date date not null,
  plan_status public.plan_status not null default 'unplanned',
  linked_booking_id uuid references public.bookings(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, work_date)
);

create index idx_attendance_user_date on public.attendance_plans(user_id, work_date);
create index idx_attendance_date on public.attendance_plans(work_date);

-- RLS
alter table public.attendance_plans enable row level security;

-- Own row
create policy "attendance: select own"
  on public.attendance_plans for select to authenticated
  using (user_id in (select id from public.users where auth_user_id = auth.uid()));

create policy "attendance: insert/update own"
  on public.attendance_plans for all to authenticated
  using (user_id in (select id from public.users where auth_user_id = auth.uid()))
  with check (user_id in (select id from public.users where auth_user_id = auth.uid()));

-- Manager can see own team
create policy "attendance: manager select team"
  on public.attendance_plans for select to authenticated
  using (
    user_id in (
      select u.id from public.users u
      join public.users me on me.auth_user_id = auth.uid()
      join public.teams t on t.id = u.team_id
      where t.manager_user_id = me.id
        or me.role in ('admin', 'system_admin')
    )
  );

create trigger attendance_plans_updated_at before update on public.attendance_plans
  for each row execute function public.set_updated_at();

-- Upsert helper RPC
create or replace function public.fn_upsert_attendance(
  p_work_date date,
  p_status public.plan_status,
  p_linked_booking_id uuid default null,
  p_notes text default null
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_me users%rowtype;
  v_plan_id uuid;
begin
  select * into v_me from public.users where auth_user_id = auth.uid();

  insert into public.attendance_plans (user_id, work_date, plan_status, linked_booking_id, notes)
  values (v_me.id, p_work_date, p_status, p_linked_booking_id, p_notes)
  on conflict (user_id, work_date) do update
    set plan_status = excluded.plan_status,
        linked_booking_id = excluded.linked_booking_id,
        notes = excluded.notes,
        updated_at = now()
  returning id into v_plan_id;

  return jsonb_build_object('plan_id', v_plan_id);
end;
$$;
