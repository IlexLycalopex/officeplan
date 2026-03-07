-- Migration 008: Notification preferences and admin schedules

create type public.schedule_type as enum (
  'weekly_digest', 'daily_digest', 'approval_alert', 'booking_confirmation'
);

create table public.notification_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique not null references public.users(id) on delete cascade,
  weekly_digest boolean not null default true,
  daily_digest boolean not null default false,
  approval_alerts boolean not null default true,   -- mandatory: cannot be turned off fully
  reminder_lead_days integer not null default 1,   -- how many days before to remind
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.notification_schedules (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  schedule_type public.schedule_type not null,
  cron_expression text not null,                   -- e.g. "0 8 * * 1" = Mon 8am
  active_flag boolean not null default true,
  last_run_at timestamptz,
  last_run_status text,                            -- 'ok' | 'error' | null
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_notif_prefs_user on public.notification_preferences(user_id);
create index idx_notif_schedules_org on public.notification_schedules(organisation_id);

alter table public.notification_preferences enable row level security;
alter table public.notification_schedules enable row level security;

create policy "notif_prefs: own row"
  on public.notification_preferences for all to authenticated
  using (user_id in (select id from public.users where auth_user_id = auth.uid()))
  with check (user_id in (select id from public.users where auth_user_id = auth.uid()));

create policy "notif_schedules: admin write"
  on public.notification_schedules for all to authenticated
  using (
    organisation_id in (
      select organisation_id from public.users
      where auth_user_id = auth.uid() and role in ('admin', 'system_admin')
    )
  );

create policy "notif_schedules: read own org"
  on public.notification_schedules for select to authenticated
  using (
    organisation_id in (
      select organisation_id from public.users where auth_user_id = auth.uid()
    )
  );

create trigger notif_prefs_updated_at before update on public.notification_preferences
  for each row execute function public.set_updated_at();
create trigger notif_schedules_updated_at before update on public.notification_schedules
  for each row execute function public.set_updated_at();

-- Auto-create notification_preferences row when user is created
create or replace function public.handle_new_user_preferences()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.notification_preferences (user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

create trigger on_user_created_preferences
  after insert on public.users
  for each row execute function public.handle_new_user_preferences();
