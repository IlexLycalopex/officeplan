-- Migration 004: Workspace Assets (desks, rooms, zones, amenities)

create type public.asset_type as enum ('desk', 'room', 'zone', 'amenity', 'no_book');
create type public.asset_status as enum ('available', 'unavailable', 'maintenance', 'restricted');
create type public.restriction_type as enum ('none', 'named_user', 'team', 'admin_only');

create table public.workspace_assets (
  id uuid primary key default gen_random_uuid(),
  floor_id uuid not null references public.floors(id) on delete cascade,
  asset_type public.asset_type not null,
  code text not null,             -- e.g. "D-01-042", "R-BOARDROOM"
  name text,                      -- human-readable label
  -- Grid coordinates (integer units matching floor width/height_units)
  x integer not null default 0,
  y integer not null default 0,
  width integer not null default 2,
  height integer not null default 1,
  capacity integer,               -- rooms: max occupants
  -- Desk/room features (free-text tags, e.g. ["standing","monitor","accessible"])
  features text[] not null default '{}',
  status public.asset_status not null default 'available',
  restriction_type public.restriction_type not null default 'none',
  -- Named restriction (null = no restriction beyond type)
  restricted_user_id uuid references public.users(id) on delete set null,
  restricted_team_id uuid references public.teams(id) on delete set null,
  -- Draft flag: layout editor stages changes before publish
  is_draft boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_workspace_assets_floor on public.workspace_assets(floor_id);
create index idx_workspace_assets_type on public.workspace_assets(asset_type);
create index idx_workspace_assets_status on public.workspace_assets(status);

-- RLS: all authenticated org members can read published assets; admins write
alter table public.workspace_assets enable row level security;

create policy "workspace_assets: read published for org"
  on public.workspace_assets for select to authenticated
  using (
    is_draft = false
    and floor_id in (
      select f.id from public.floors f
      join public.offices o on o.id = f.office_id
      join public.users u on u.organisation_id = o.organisation_id
      where u.auth_user_id = auth.uid()
    )
  );

create policy "workspace_assets: admin read all incl draft"
  on public.workspace_assets for select to authenticated
  using (
    floor_id in (
      select f.id from public.floors f
      join public.offices o on o.id = f.office_id
      join public.users u on u.organisation_id = o.organisation_id
      where u.auth_user_id = auth.uid()
        and u.role in ('admin', 'system_admin')
    )
  );

create policy "workspace_assets: admin write"
  on public.workspace_assets for all to authenticated
  using (
    floor_id in (
      select f.id from public.floors f
      join public.offices o on o.id = f.office_id
      join public.users u on u.organisation_id = o.organisation_id
      where u.auth_user_id = auth.uid()
        and u.role in ('admin', 'system_admin')
    )
  );

create trigger workspace_assets_updated_at before update on public.workspace_assets
  for each row execute function public.set_updated_at();

-- Publish function: promotes all draft assets on a floor to published
create or replace function public.publish_floor_layout(p_floor_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.workspace_assets
  set is_draft = false, updated_at = now()
  where floor_id = p_floor_id and is_draft = true;
end;
$$;
