-- Migration 003: Offices and Floors

create table public.offices (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  name text not null,
  address text,
  city text,
  timezone text not null default 'Europe/London',
  active_flag boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.floors (
  id uuid primary key default gen_random_uuid(),
  office_id uuid not null references public.offices(id) on delete cascade,
  name text not null,             -- e.g. "Ground Floor", "Floor 1"
  sequence integer not null default 1,
  map_background_url text,        -- optional background image (phase 2)
  width_units integer not null default 100,
  height_units integer not null default 60,
  active_flag boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Add office FK to users now the table exists
alter table public.users
  add constraint fk_users_office foreign key (primary_office_id)
  references public.offices(id) on delete set null;

create index idx_offices_org on public.offices(organisation_id);
create index idx_floors_office on public.floors(office_id);

-- RLS
alter table public.offices enable row level security;
alter table public.floors enable row level security;

create policy "offices: read own org"
  on public.offices for select to authenticated
  using (
    organisation_id in (
      select organisation_id from public.users where auth_user_id = auth.uid()
    )
  );

create policy "offices: admin write"
  on public.offices for all to authenticated
  using (
    organisation_id in (
      select organisation_id from public.users
      where auth_user_id = auth.uid() and role in ('admin', 'system_admin')
    )
  );

create policy "floors: read own org"
  on public.floors for select to authenticated
  using (
    office_id in (
      select o.id from public.offices o
      join public.users u on u.organisation_id = o.organisation_id
      where u.auth_user_id = auth.uid()
    )
  );

create policy "floors: admin write"
  on public.floors for all to authenticated
  using (
    office_id in (
      select o.id from public.offices o
      join public.users u on u.organisation_id = o.organisation_id
      where u.auth_user_id = auth.uid() and u.role in ('admin', 'system_admin')
    )
  );

create trigger offices_updated_at before update on public.offices
  for each row execute function public.set_updated_at();
create trigger floors_updated_at before update on public.floors
  for each row execute function public.set_updated_at();
