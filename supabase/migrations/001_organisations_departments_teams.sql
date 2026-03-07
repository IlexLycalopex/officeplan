-- Migration 001: Organisations, Departments, Teams
-- All tables include organisation_id for phase-2 multi-tenant readiness

create table public.organisations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  logo_url text,
  active_flag boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.departments (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  name text not null,
  code text,
  active_flag boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organisation_id, name)
);

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  department_id uuid references public.departments(id) on delete set null,
  name text not null,
  manager_user_id uuid, -- FK added after users table
  active_flag boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Indexes
create index idx_departments_org on public.departments(organisation_id);
create index idx_teams_org on public.teams(organisation_id);
create index idx_teams_department on public.teams(department_id);

-- RLS
alter table public.organisations enable row level security;
alter table public.departments enable row level security;
alter table public.teams enable row level security;

-- Policies: authenticated users can read their own org's data
-- (organisation membership resolved via users table — added in 002)
-- Admins write; everyone in org reads

create policy "organisations: authenticated read own org"
  on public.organisations for select
  to authenticated
  using (
    id in (
      select organisation_id from public.users
      where auth_user_id = auth.uid()
    )
  );

create policy "departments: read own org"
  on public.departments for select
  to authenticated
  using (
    organisation_id in (
      select organisation_id from public.users
      where auth_user_id = auth.uid()
    )
  );

create policy "departments: admin write"
  on public.departments for all
  to authenticated
  using (
    organisation_id in (
      select organisation_id from public.users
      where auth_user_id = auth.uid()
        and role in ('admin', 'system_admin')
    )
  );

create policy "teams: read own org"
  on public.teams for select
  to authenticated
  using (
    organisation_id in (
      select organisation_id from public.users
      where auth_user_id = auth.uid()
    )
  );

create policy "teams: admin write"
  on public.teams for all
  to authenticated
  using (
    organisation_id in (
      select organisation_id from public.users
      where auth_user_id = auth.uid()
        and role in ('admin', 'system_admin')
    )
  );

-- updated_at triggers
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger organisations_updated_at before update on public.organisations
  for each row execute function public.set_updated_at();
create trigger departments_updated_at before update on public.departments
  for each row execute function public.set_updated_at();
create trigger teams_updated_at before update on public.teams
  for each row execute function public.set_updated_at();
