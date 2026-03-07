-- Migration 016: Security-definer RLS helpers — eliminate all RLS recursion
--
-- Root cause: any RLS policy on public.users that contains a subquery into
-- public.users (even indirectly) triggers infinite recursion (PG error 42P17).
-- The canonical fix is stable SECURITY DEFINER functions that bypass RLS when
-- reading the users table for the calling user's own identity/role.
--
-- Four helpers are created, then ALL policies across all tables are rewritten
-- to use them — no policy body anywhere now has a direct subquery into public.users.

-- ─── Helper functions ────────────────────────────────────────────────────────

create or replace function public.fn_user_id()
returns uuid language sql stable security definer set search_path = public as $$
  select id from users where auth_user_id = auth.uid() limit 1
$$;

create or replace function public.fn_user_org_id()
returns uuid language sql stable security definer set search_path = public as $$
  select organisation_id from users where auth_user_id = auth.uid() limit 1
$$;

create or replace function public.fn_user_is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from users
    where auth_user_id = auth.uid()
      and role in ('admin', 'system_admin')
  )
$$;

create or replace function public.fn_user_is_approver()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from users
    where auth_user_id = auth.uid()
      and role in ('admin', 'system_admin', 'approver')
  )
$$;

-- ─── Drop all existing policies (cumulative list from migrations 001–015) ────

-- organisations
drop policy if exists "organisations: member select" on public.organisations;
drop policy if exists "organisations: select" on public.organisations;

-- departments
drop policy if exists "departments: member select" on public.departments;
drop policy if exists "departments: select" on public.departments;
drop policy if exists "departments: admin write" on public.departments;
drop policy if exists "departments: admin insert" on public.departments;
drop policy if exists "departments: admin update" on public.departments;
drop policy if exists "departments: admin delete" on public.departments;

-- teams
drop policy if exists "teams: member select" on public.teams;
drop policy if exists "teams: select" on public.teams;
drop policy if exists "teams: admin write" on public.teams;
drop policy if exists "teams: admin insert" on public.teams;
drop policy if exists "teams: admin update" on public.teams;
drop policy if exists "teams: admin delete" on public.teams;

-- users
drop policy if exists "users: select own row" on public.users;
drop policy if exists "users: select org members" on public.users;
drop policy if exists "users: select own org" on public.users;
drop policy if exists "users: select own org (authenticated)" on public.users;
drop policy if exists "users: select" on public.users;
drop policy if exists "users: update own row" on public.users;
drop policy if exists "users: update" on public.users;
drop policy if exists "users: admin update" on public.users;
drop policy if exists "users: admin insert" on public.users;
drop policy if exists "users: admin delete" on public.users;

-- offices
drop policy if exists "offices: member select" on public.offices;
drop policy if exists "offices: select" on public.offices;
drop policy if exists "offices: admin write" on public.offices;
drop policy if exists "offices: admin insert" on public.offices;
drop policy if exists "offices: admin update" on public.offices;
drop policy if exists "offices: admin delete" on public.offices;

-- floors
drop policy if exists "floors: member select" on public.floors;
drop policy if exists "floors: select" on public.floors;
drop policy if exists "floors: admin write" on public.floors;
drop policy if exists "floors: admin insert" on public.floors;
drop policy if exists "floors: admin update" on public.floors;
drop policy if exists "floors: admin delete" on public.floors;

-- workspace_assets
drop policy if exists "workspace_assets: authenticated select" on public.workspace_assets;
drop policy if exists "workspace_assets: select published" on public.workspace_assets;
drop policy if exists "workspace_assets: select" on public.workspace_assets;
drop policy if exists "workspace_assets: admin select drafts" on public.workspace_assets;
drop policy if exists "workspace_assets: admin write" on public.workspace_assets;
drop policy if exists "workspace_assets: admin insert" on public.workspace_assets;
drop policy if exists "workspace_assets: admin update" on public.workspace_assets;
drop policy if exists "workspace_assets: admin delete" on public.workspace_assets;

-- bookings
drop policy if exists "bookings: select own" on public.bookings;
drop policy if exists "bookings: select team (manager)" on public.bookings;
drop policy if exists "bookings: select team or admin" on public.bookings;
drop policy if exists "bookings: select" on public.bookings;
drop policy if exists "bookings: insert own" on public.bookings;
drop policy if exists "bookings: insert own within policy" on public.bookings;
drop policy if exists "bookings: admin insert" on public.bookings;
drop policy if exists "bookings: insert" on public.bookings;
drop policy if exists "bookings: update own" on public.bookings;
drop policy if exists "bookings: admin update" on public.bookings;
drop policy if exists "bookings: update" on public.bookings;
drop policy if exists "bookings: admin delete" on public.bookings;

-- approval_requests
drop policy if exists "approvals: requester read own" on public.approval_requests;
drop policy if exists "approvals: approver/admin all" on public.approval_requests;
drop policy if exists "approvals: select" on public.approval_requests;
drop policy if exists "approvals: approver/admin insert" on public.approval_requests;
drop policy if exists "approvals: approver/admin update" on public.approval_requests;
drop policy if exists "approvals: admin delete" on public.approval_requests;

-- attendance_plans
drop policy if exists "attendance: own row all" on public.attendance_plans;
drop policy if exists "attendance: insert/update own" on public.attendance_plans;
drop policy if exists "attendance: insert own" on public.attendance_plans;
drop policy if exists "attendance: update own" on public.attendance_plans;
drop policy if exists "attendance: delete own" on public.attendance_plans;
drop policy if exists "attendance: manager select team" on public.attendance_plans;
drop policy if exists "attendance: manager/admin select" on public.attendance_plans;
drop policy if exists "attendance: select" on public.attendance_plans;

-- notification_preferences
drop policy if exists "notif_prefs: own row" on public.notification_preferences;
drop policy if exists "notif_prefs: select" on public.notification_preferences;
drop policy if exists "notif_prefs: insert" on public.notification_preferences;
drop policy if exists "notif_prefs: update" on public.notification_preferences;

-- notification_schedules
drop policy if exists "notif_schedules: admin write" on public.notification_schedules;
drop policy if exists "notif_schedules: read own org" on public.notification_schedules;
drop policy if exists "notif_schedules: select" on public.notification_schedules;
drop policy if exists "notif_schedules: admin insert" on public.notification_schedules;
drop policy if exists "notif_schedules: admin update" on public.notification_schedules;
drop policy if exists "notif_schedules: admin delete" on public.notification_schedules;

-- audit_events
drop policy if exists "audit: admin read" on public.audit_events;

-- ─── Recreate all policies using helper functions (no public.users subqueries) ─

-- organisations
create policy "organisations: select"
  on public.organisations for select to authenticated
  using (id = public.fn_user_org_id());

-- departments
create policy "departments: select"
  on public.departments for select to authenticated
  using (organisation_id = public.fn_user_org_id());

create policy "departments: admin insert"
  on public.departments for insert to authenticated
  with check (public.fn_user_is_admin() and organisation_id = public.fn_user_org_id());

create policy "departments: admin update"
  on public.departments for update to authenticated
  using (public.fn_user_is_admin() and organisation_id = public.fn_user_org_id())
  with check (public.fn_user_is_admin() and organisation_id = public.fn_user_org_id());

create policy "departments: admin delete"
  on public.departments for delete to authenticated
  using (public.fn_user_is_admin() and organisation_id = public.fn_user_org_id());

-- teams
create policy "teams: select"
  on public.teams for select to authenticated
  using (organisation_id = public.fn_user_org_id());

create policy "teams: admin insert"
  on public.teams for insert to authenticated
  with check (public.fn_user_is_admin() and organisation_id = public.fn_user_org_id());

create policy "teams: admin update"
  on public.teams for update to authenticated
  using (public.fn_user_is_admin() and organisation_id = public.fn_user_org_id())
  with check (public.fn_user_is_admin() and organisation_id = public.fn_user_org_id());

create policy "teams: admin delete"
  on public.teams for delete to authenticated
  using (public.fn_user_is_admin() and organisation_id = public.fn_user_org_id());

-- users (two SELECT policies: direct auth check + helper for org members — no recursion)
create policy "users: select own row"
  on public.users for select to authenticated
  using (auth_user_id = (select auth.uid()));

create policy "users: select org members"
  on public.users for select to authenticated
  using (organisation_id = public.fn_user_org_id());

create policy "users: update"
  on public.users for update to authenticated
  using (
    auth_user_id = (select auth.uid())
    or (public.fn_user_is_admin() and organisation_id = public.fn_user_org_id())
  )
  with check (
    auth_user_id = (select auth.uid())
    or (public.fn_user_is_admin() and organisation_id = public.fn_user_org_id())
  );

create policy "users: admin insert"
  on public.users for insert to authenticated
  with check (public.fn_user_is_admin() and organisation_id = public.fn_user_org_id());

create policy "users: admin delete"
  on public.users for delete to authenticated
  using (public.fn_user_is_admin() and organisation_id = public.fn_user_org_id());

-- offices
create policy "offices: select"
  on public.offices for select to authenticated
  using (organisation_id = public.fn_user_org_id());

create policy "offices: admin insert"
  on public.offices for insert to authenticated
  with check (public.fn_user_is_admin() and organisation_id = public.fn_user_org_id());

create policy "offices: admin update"
  on public.offices for update to authenticated
  using (public.fn_user_is_admin() and organisation_id = public.fn_user_org_id())
  with check (public.fn_user_is_admin() and organisation_id = public.fn_user_org_id());

create policy "offices: admin delete"
  on public.offices for delete to authenticated
  using (public.fn_user_is_admin() and organisation_id = public.fn_user_org_id());

-- floors
create policy "floors: select"
  on public.floors for select to authenticated
  using (
    office_id in (
      select id from public.offices where organisation_id = public.fn_user_org_id()
    )
  );

create policy "floors: admin insert"
  on public.floors for insert to authenticated
  with check (
    public.fn_user_is_admin()
    and office_id in (
      select id from public.offices where organisation_id = public.fn_user_org_id()
    )
  );

create policy "floors: admin update"
  on public.floors for update to authenticated
  using (
    public.fn_user_is_admin()
    and office_id in (
      select id from public.offices where organisation_id = public.fn_user_org_id()
    )
  )
  with check (
    public.fn_user_is_admin()
    and office_id in (
      select id from public.offices where organisation_id = public.fn_user_org_id()
    )
  );

create policy "floors: admin delete"
  on public.floors for delete to authenticated
  using (
    public.fn_user_is_admin()
    and office_id in (
      select id from public.offices where organisation_id = public.fn_user_org_id()
    )
  );

-- workspace_assets
create policy "workspace_assets: select"
  on public.workspace_assets for select to authenticated
  using (
    floor_id in (
      select f.id from public.floors f
      join public.offices o on o.id = f.office_id
      where o.organisation_id = public.fn_user_org_id()
    )
    and (is_draft = false or public.fn_user_is_admin())
  );

create policy "workspace_assets: admin insert"
  on public.workspace_assets for insert to authenticated
  with check (
    public.fn_user_is_admin()
    and floor_id in (
      select f.id from public.floors f
      join public.offices o on o.id = f.office_id
      where o.organisation_id = public.fn_user_org_id()
    )
  );

create policy "workspace_assets: admin update"
  on public.workspace_assets for update to authenticated
  using (
    public.fn_user_is_admin()
    and floor_id in (
      select f.id from public.floors f
      join public.offices o on o.id = f.office_id
      where o.organisation_id = public.fn_user_org_id()
    )
  )
  with check (
    public.fn_user_is_admin()
    and floor_id in (
      select f.id from public.floors f
      join public.offices o on o.id = f.office_id
      where o.organisation_id = public.fn_user_org_id()
    )
  );

create policy "workspace_assets: admin delete"
  on public.workspace_assets for delete to authenticated
  using (
    public.fn_user_is_admin()
    and floor_id in (
      select f.id from public.floors f
      join public.offices o on o.id = f.office_id
      where o.organisation_id = public.fn_user_org_id()
    )
  );

-- bookings
create policy "bookings: select"
  on public.bookings for select to authenticated
  using (
    user_id = public.fn_user_id()
    or public.fn_user_is_admin()
    or public.fn_user_id() in (
      select t.manager_user_id from public.teams t
      join public.users u on u.team_id = t.id
      where u.id = bookings.user_id
    )
  );

create policy "bookings: insert"
  on public.bookings for insert to authenticated
  with check (user_id = public.fn_user_id() or public.fn_user_is_admin());

create policy "bookings: update"
  on public.bookings for update to authenticated
  using (user_id = public.fn_user_id() or public.fn_user_is_admin());

create policy "bookings: admin delete"
  on public.bookings for delete to authenticated
  using (public.fn_user_is_admin());

-- approval_requests
create policy "approvals: select"
  on public.approval_requests for select to authenticated
  using (
    requester_user_id = public.fn_user_id()
    or approver_user_id = public.fn_user_id()
    or public.fn_user_is_approver()
  );

create policy "approvals: approver/admin insert"
  on public.approval_requests for insert to authenticated
  with check (public.fn_user_is_approver());

create policy "approvals: approver/admin update"
  on public.approval_requests for update to authenticated
  using (approver_user_id = public.fn_user_id() or public.fn_user_is_approver())
  with check (approver_user_id = public.fn_user_id() or public.fn_user_is_approver());

create policy "approvals: admin delete"
  on public.approval_requests for delete to authenticated
  using (public.fn_user_is_admin());

-- attendance_plans
create policy "attendance: select"
  on public.attendance_plans for select to authenticated
  using (
    user_id = public.fn_user_id()
    or public.fn_user_is_admin()
    or public.fn_user_id() in (
      select t.manager_user_id from public.teams t
      join public.users u on u.team_id = t.id
      where u.id = attendance_plans.user_id
    )
  );

create policy "attendance: insert own"
  on public.attendance_plans for insert to authenticated
  with check (user_id = public.fn_user_id());

create policy "attendance: update own"
  on public.attendance_plans for update to authenticated
  using (user_id = public.fn_user_id())
  with check (user_id = public.fn_user_id());

create policy "attendance: delete own"
  on public.attendance_plans for delete to authenticated
  using (user_id = public.fn_user_id());

-- notification_preferences
create policy "notif_prefs: select"
  on public.notification_preferences for select to authenticated
  using (user_id = public.fn_user_id());

create policy "notif_prefs: insert"
  on public.notification_preferences for insert to authenticated
  with check (user_id = public.fn_user_id());

create policy "notif_prefs: update"
  on public.notification_preferences for update to authenticated
  using (user_id = public.fn_user_id())
  with check (user_id = public.fn_user_id());

-- notification_schedules
create policy "notif_schedules: select"
  on public.notification_schedules for select to authenticated
  using (organisation_id = public.fn_user_org_id());

create policy "notif_schedules: admin insert"
  on public.notification_schedules for insert to authenticated
  with check (public.fn_user_is_admin() and organisation_id = public.fn_user_org_id());

create policy "notif_schedules: admin update"
  on public.notification_schedules for update to authenticated
  using (public.fn_user_is_admin() and organisation_id = public.fn_user_org_id())
  with check (public.fn_user_is_admin() and organisation_id = public.fn_user_org_id());

create policy "notif_schedules: admin delete"
  on public.notification_schedules for delete to authenticated
  using (public.fn_user_is_admin() and organisation_id = public.fn_user_org_id());

-- audit_events
create policy "audit: admin read"
  on public.audit_events for select to authenticated
  using (public.fn_user_is_admin());
