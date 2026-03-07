-- Migration 002: Users profile table
-- Linked to auth.users via auth_user_id. Role drives RLS.

create type public.user_role as enum ('employee', 'manager', 'approver', 'admin', 'system_admin');
create type public.employment_status as enum ('active', 'inactive', 'on_leave');

create table public.users (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete cascade,
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  email text not null,
  first_name text not null,
  last_name text not null,
  job_title text,
  role public.user_role not null default 'employee',
  status public.employment_status not null default 'active',
  department_id uuid references public.departments(id) on delete set null,
  team_id uuid references public.teams(id) on delete set null,
  manager_user_id uuid references public.users(id) on delete set null,
  primary_office_id uuid, -- FK to offices added in 003
  -- Working pattern (day 0=Sun, 1=Mon … 6=Sat)
  normal_working_days integer[] not null default '{1,2,3,4,5}',
  normal_office_days integer[] not null default '{1,3}', -- e.g. Mon+Wed
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Now we can add the manager FK to teams
alter table public.teams
  add constraint fk_teams_manager foreign key (manager_user_id)
  references public.users(id) on delete set null;

create index idx_users_auth_user_id on public.users(auth_user_id);
create index idx_users_org on public.users(organisation_id);
create index idx_users_team on public.users(team_id);
create index idx_users_department on public.users(department_id);
create index idx_users_manager on public.users(manager_user_id);

-- RLS
alter table public.users enable row level security;

create policy "users: select own row"
  on public.users for select
  to authenticated
  using (auth_user_id = auth.uid());

create policy "users: select own org (authenticated)"
  on public.users for select
  to authenticated
  using (
    organisation_id in (
      select organisation_id from public.users
      where auth_user_id = auth.uid()
    )
  );

create policy "users: update own row"
  on public.users for update
  to authenticated
  using (auth_user_id = auth.uid())
  with check (auth_user_id = auth.uid());

create policy "users: admin write"
  on public.users for all
  to authenticated
  using (
    organisation_id in (
      select organisation_id from public.users u2
      where u2.auth_user_id = auth.uid()
        and u2.role in ('admin', 'system_admin')
    )
  );

-- Auto-create user row on sign-up
-- (The front end also calls this on first login; the trigger handles new sign-ups)
create or replace function public.handle_new_auth_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  default_org_id uuid;
begin
  -- Use the first (and only for phase 1) organisation
  select id into default_org_id from public.organisations limit 1;

  if default_org_id is null then
    return new; -- No org yet; admin must assign manually
  end if;

  insert into public.users (
    auth_user_id, organisation_id, email, first_name, last_name
  )
  values (
    new.id,
    default_org_id,
    new.email,
    split_part(new.email, '@', 1), -- placeholder first name
    ''
  )
  on conflict (auth_user_id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

create trigger users_updated_at before update on public.users
  for each row execute function public.set_updated_at();
