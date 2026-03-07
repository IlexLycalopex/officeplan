-- Migration 013: RLS Performance Optimisations + FK Indexes
--
-- Fixes three categories of Supabase advisor warnings:
--
--   [WARN] auth_rls_initplan        – bare auth.uid() inside RLS subqueries is evaluated
--                                     once per row; wrapping in (select auth.uid()) makes
--                                     it a stable init-plan evaluated once per statement.
--
--   [WARN] multiple_permissive_policies – multiple permissive policies for the same role
--                                         and operation (SELECT) on the same table are
--                                         OR-ed by PG, which is correct but suboptimal.
--                                         Fix: one unified SELECT policy per table.
--                                         Admin write split into INSERT / UPDATE / DELETE
--                                         (separate statements) to avoid a second SELECT.
--
--   [INFO] unindexed_foreign_keys   – FK columns without a covering index cause seq-scans
--                                     on JOIN / ON DELETE SET NULL operations.
--
-- Note: DROP statements use IF EXISTS and enumerate all known historical names to be
-- idempotent across databases whose policies may have been renamed in earlier sessions.


-- ═══════════════════════════════════════════════════════════
-- ORGANISATIONS
-- ═══════════════════════════════════════════════════════════

drop policy if exists "organisations: authenticated read own org" on public.organisations;
drop policy if exists "organisations: select"                     on public.organisations;

create policy "organisations: select"
  on public.organisations for select to authenticated
  using (
    id in (
      select organisation_id from public.users
      where auth_user_id = (select auth.uid())
    )
  );


-- ═══════════════════════════════════════════════════════════
-- DEPARTMENTS
-- ═══════════════════════════════════════════════════════════

drop policy if exists "departments: read own org"  on public.departments;
drop policy if exists "departments: admin write"   on public.departments;
drop policy if exists "departments: select"        on public.departments;
drop policy if exists "departments: admin insert"  on public.departments;
drop policy if exists "departments: admin update"  on public.departments;
drop policy if exists "departments: admin delete"  on public.departments;

create policy "departments: select"
  on public.departments for select to authenticated
  using (
    organisation_id in (
      select organisation_id from public.users
      where auth_user_id = (select auth.uid())
    )
  );

create policy "departments: admin insert"
  on public.departments for insert to authenticated
  with check (
    organisation_id in (
      select organisation_id from public.users
      where auth_user_id = (select auth.uid())
        and role in ('admin', 'system_admin')
    )
  );

create policy "departments: admin update"
  on public.departments for update to authenticated
  using (
    organisation_id in (
      select organisation_id from public.users
      where auth_user_id = (select auth.uid())
        and role in ('admin', 'system_admin')
    )
  )
  with check (
    organisation_id in (
      select organisation_id from public.users
      where auth_user_id = (select auth.uid())
        and role in ('admin', 'system_admin')
    )
  );

create policy "departments: admin delete"
  on public.departments for delete to authenticated
  using (
    organisation_id in (
      select organisation_id from public.users
      where auth_user_id = (select auth.uid())
        and role in ('admin', 'system_admin')
    )
  );


-- ═══════════════════════════════════════════════════════════
-- TEAMS
-- ═══════════════════════════════════════════════════════════

drop policy if exists "teams: read own org"   on public.teams;
drop policy if exists "teams: admin write"    on public.teams;
drop policy if exists "teams: select"         on public.teams;
drop policy if exists "teams: admin insert"   on public.teams;
drop policy if exists "teams: admin update"   on public.teams;
drop policy if exists "teams: admin delete"   on public.teams;

create policy "teams: select"
  on public.teams for select to authenticated
  using (
    organisation_id in (
      select organisation_id from public.users
      where auth_user_id = (select auth.uid())
    )
  );

create policy "teams: admin insert"
  on public.teams for insert to authenticated
  with check (
    organisation_id in (
      select organisation_id from public.users
      where auth_user_id = (select auth.uid())
        and role in ('admin', 'system_admin')
    )
  );

create policy "teams: admin update"
  on public.teams for update to authenticated
  using (
    organisation_id in (
      select organisation_id from public.users
      where auth_user_id = (select auth.uid())
        and role in ('admin', 'system_admin')
    )
  )
  with check (
    organisation_id in (
      select organisation_id from public.users
      where auth_user_id = (select auth.uid())
        and role in ('admin', 'system_admin')
    )
  );

create policy "teams: admin delete"
  on public.teams for delete to authenticated
  using (
    organisation_id in (
      select organisation_id from public.users
      where auth_user_id = (select auth.uid())
        and role in ('admin', 'system_admin')
    )
  );


-- ═══════════════════════════════════════════════════════════
-- USERS
-- Consolidates 2 SELECT policies into 1; splits admin ALL
-- into INSERT / UPDATE / DELETE to avoid a second SELECT.
-- ═══════════════════════════════════════════════════════════

drop policy if exists "users: select own row"                 on public.users;
drop policy if exists "users: select own org (authenticated)" on public.users;
drop policy if exists "users: select own org"                 on public.users;
drop policy if exists "users: update own row"                 on public.users;
drop policy if exists "users: admin write"                    on public.users;
drop policy if exists "users: select"                         on public.users;
drop policy if exists "users: admin insert"                   on public.users;
drop policy if exists "users: admin update"                   on public.users;
drop policy if exists "users: admin delete"                   on public.users;

-- Unified SELECT: own row OR anyone in same org (staff directory)
create policy "users: select"
  on public.users for select to authenticated
  using (
    auth_user_id = (select auth.uid())
    or organisation_id in (
      select organisation_id from public.users u2
      where u2.auth_user_id = (select auth.uid())
    )
  );

-- Self-update (profile page)
create policy "users: update own row"
  on public.users for update to authenticated
  using  (auth_user_id = (select auth.uid()))
  with check (auth_user_id = (select auth.uid()));

-- Admin write (separate operations avoid a 2nd permissive SELECT)
create policy "users: admin insert"
  on public.users for insert to authenticated
  with check (
    organisation_id in (
      select organisation_id from public.users u2
      where u2.auth_user_id = (select auth.uid())
        and u2.role in ('admin', 'system_admin')
    )
  );

create policy "users: admin update"
  on public.users for update to authenticated
  using (
    organisation_id in (
      select organisation_id from public.users u2
      where u2.auth_user_id = (select auth.uid())
        and u2.role in ('admin', 'system_admin')
    )
  )
  with check (
    organisation_id in (
      select organisation_id from public.users u2
      where u2.auth_user_id = (select auth.uid())
        and u2.role in ('admin', 'system_admin')
    )
  );

create policy "users: admin delete"
  on public.users for delete to authenticated
  using (
    organisation_id in (
      select organisation_id from public.users u2
      where u2.auth_user_id = (select auth.uid())
        and u2.role in ('admin', 'system_admin')
    )
  );


-- ═══════════════════════════════════════════════════════════
-- OFFICES
-- ═══════════════════════════════════════════════════════════

drop policy if exists "offices: read own org"  on public.offices;
drop policy if exists "offices: admin write"   on public.offices;
drop policy if exists "offices: select"        on public.offices;
drop policy if exists "offices: admin insert"  on public.offices;
drop policy if exists "offices: admin update"  on public.offices;
drop policy if exists "offices: admin delete"  on public.offices;

create policy "offices: select"
  on public.offices for select to authenticated
  using (
    organisation_id in (
      select organisation_id from public.users
      where auth_user_id = (select auth.uid())
    )
  );

create policy "offices: admin insert"
  on public.offices for insert to authenticated
  with check (
    organisation_id in (
      select organisation_id from public.users
      where auth_user_id = (select auth.uid())
        and role in ('admin', 'system_admin')
    )
  );

create policy "offices: admin update"
  on public.offices for update to authenticated
  using (
    organisation_id in (
      select organisation_id from public.users
      where auth_user_id = (select auth.uid())
        and role in ('admin', 'system_admin')
    )
  )
  with check (
    organisation_id in (
      select organisation_id from public.users
      where auth_user_id = (select auth.uid())
        and role in ('admin', 'system_admin')
    )
  );

create policy "offices: admin delete"
  on public.offices for delete to authenticated
  using (
    organisation_id in (
      select organisation_id from public.users
      where auth_user_id = (select auth.uid())
        and role in ('admin', 'system_admin')
    )
  );


-- ═══════════════════════════════════════════════════════════
-- FLOORS
-- ═══════════════════════════════════════════════════════════

drop policy if exists "floors: read own org"  on public.floors;
drop policy if exists "floors: admin write"   on public.floors;
drop policy if exists "floors: select"        on public.floors;
drop policy if exists "floors: admin insert"  on public.floors;
drop policy if exists "floors: admin update"  on public.floors;
drop policy if exists "floors: admin delete"  on public.floors;

create policy "floors: select"
  on public.floors for select to authenticated
  using (
    office_id in (
      select o.id from public.offices o
      join public.users u on u.organisation_id = o.organisation_id
      where u.auth_user_id = (select auth.uid())
    )
  );

create policy "floors: admin insert"
  on public.floors for insert to authenticated
  with check (
    office_id in (
      select o.id from public.offices o
      join public.users u on u.organisation_id = o.organisation_id
      where u.auth_user_id = (select auth.uid())
        and u.role in ('admin', 'system_admin')
    )
  );

create policy "floors: admin update"
  on public.floors for update to authenticated
  using (
    office_id in (
      select o.id from public.offices o
      join public.users u on u.organisation_id = o.organisation_id
      where u.auth_user_id = (select auth.uid())
        and u.role in ('admin', 'system_admin')
    )
  )
  with check (
    office_id in (
      select o.id from public.offices o
      join public.users u on u.organisation_id = o.organisation_id
      where u.auth_user_id = (select auth.uid())
        and u.role in ('admin', 'system_admin')
    )
  );

create policy "floors: admin delete"
  on public.floors for delete to authenticated
  using (
    office_id in (
      select o.id from public.offices o
      join public.users u on u.organisation_id = o.organisation_id
      where u.auth_user_id = (select auth.uid())
        and u.role in ('admin', 'system_admin')
    )
  );


-- ═══════════════════════════════════════════════════════════
-- WORKSPACE ASSETS
-- Consolidates 2 SELECT policies (published + admin-draft) into 1.
-- ═══════════════════════════════════════════════════════════

drop policy if exists "workspace_assets: read published for org"    on public.workspace_assets;
drop policy if exists "workspace_assets: admin read all incl draft" on public.workspace_assets;
drop policy if exists "workspace_assets: admin write"               on public.workspace_assets;
drop policy if exists "workspace_assets: select"                    on public.workspace_assets;
drop policy if exists "workspace_assets: admin insert"              on public.workspace_assets;
drop policy if exists "workspace_assets: admin update"              on public.workspace_assets;
drop policy if exists "workspace_assets: admin delete"              on public.workspace_assets;

-- Unified: org member sees published; admin sees drafts too
create policy "workspace_assets: select"
  on public.workspace_assets for select to authenticated
  using (
    floor_id in (
      select f.id from public.floors f
      join public.offices o on o.id = f.office_id
      join public.users u on u.organisation_id = o.organisation_id
      where u.auth_user_id = (select auth.uid())
    )
    and (
      is_draft = false
      or exists (
        select 1 from public.users
        where auth_user_id = (select auth.uid())
          and role in ('admin', 'system_admin')
      )
    )
  );

create policy "workspace_assets: admin insert"
  on public.workspace_assets for insert to authenticated
  with check (
    floor_id in (
      select f.id from public.floors f
      join public.offices o on o.id = f.office_id
      join public.users u on u.organisation_id = o.organisation_id
      where u.auth_user_id = (select auth.uid())
        and u.role in ('admin', 'system_admin')
    )
  );

create policy "workspace_assets: admin update"
  on public.workspace_assets for update to authenticated
  using (
    floor_id in (
      select f.id from public.floors f
      join public.offices o on o.id = f.office_id
      join public.users u on u.organisation_id = o.organisation_id
      where u.auth_user_id = (select auth.uid())
        and u.role in ('admin', 'system_admin')
    )
  )
  with check (
    floor_id in (
      select f.id from public.floors f
      join public.offices o on o.id = f.office_id
      join public.users u on u.organisation_id = o.organisation_id
      where u.auth_user_id = (select auth.uid())
        and u.role in ('admin', 'system_admin')
    )
  );

create policy "workspace_assets: admin delete"
  on public.workspace_assets for delete to authenticated
  using (
    floor_id in (
      select f.id from public.floors f
      join public.offices o on o.id = f.office_id
      join public.users u on u.organisation_id = o.organisation_id
      where u.auth_user_id = (select auth.uid())
        and u.role in ('admin', 'system_admin')
    )
  );


-- ═══════════════════════════════════════════════════════════
-- BOOKINGS
-- Consolidates 3 SELECT policies into 1 unified SELECT.
-- Admin write split into INSERT / UPDATE / DELETE.
-- ═══════════════════════════════════════════════════════════

drop policy if exists "bookings: select own"               on public.bookings;
drop policy if exists "bookings: select team (manager)"    on public.bookings;
drop policy if exists "bookings: select team or admin"     on public.bookings;
drop policy if exists "bookings: insert own within policy" on public.bookings;
drop policy if exists "bookings: insert own"               on public.bookings;
drop policy if exists "bookings: update own"               on public.bookings;
drop policy if exists "bookings: admin all"                on public.bookings;
drop policy if exists "bookings: select"                   on public.bookings;
drop policy if exists "bookings: admin insert"             on public.bookings;
drop policy if exists "bookings: admin update"             on public.bookings;
drop policy if exists "bookings: admin delete"             on public.bookings;

-- Unified SELECT: own bookings OR managed-team bookings OR admin
create policy "bookings: select"
  on public.bookings for select to authenticated
  using (
    exists (
      select 1 from public.users me
      where me.auth_user_id = (select auth.uid())
        and (
          -- Own bookings
          me.id = public.bookings.user_id
          -- Bookings of users in teams I manage
          or me.id in (
            select t.manager_user_id from public.teams t
            join public.users u on u.team_id = t.id
            where u.id = public.bookings.user_id
          )
          -- Admins see all
          or me.role in ('admin', 'system_admin')
        )
    )
  );

-- INSERT: self or admin (consolidated in migration 014)
create policy "bookings: insert own"
  on public.bookings for insert to authenticated
  with check (
    user_id in (select id from public.users where auth_user_id = (select auth.uid()))
  );

create policy "bookings: admin insert"
  on public.bookings for insert to authenticated
  with check (
    exists (
      select 1 from public.users
      where auth_user_id = (select auth.uid())
        and role in ('admin', 'system_admin')
    )
  );

-- UPDATE: self or admin (consolidated in migration 014)
create policy "bookings: update own"
  on public.bookings for update to authenticated
  using (
    user_id in (select id from public.users where auth_user_id = (select auth.uid()))
  );

create policy "bookings: admin update"
  on public.bookings for update to authenticated
  using (
    exists (
      select 1 from public.users
      where auth_user_id = (select auth.uid())
        and role in ('admin', 'system_admin')
    )
  );

-- DELETE: admin only
create policy "bookings: admin delete"
  on public.bookings for delete to authenticated
  using (
    exists (
      select 1 from public.users
      where auth_user_id = (select auth.uid())
        and role in ('admin', 'system_admin')
    )
  );


-- ═══════════════════════════════════════════════════════════
-- ATTENDANCE PLANS
-- Consolidates 3 policies into 1 unified SELECT + explicit write ops.
-- ═══════════════════════════════════════════════════════════

drop policy if exists "attendance: select own"           on public.attendance_plans;
drop policy if exists "attendance: insert/update own"    on public.attendance_plans;
drop policy if exists "attendance: own row all"          on public.attendance_plans;
drop policy if exists "attendance: manager select team"  on public.attendance_plans;
drop policy if exists "attendance: manager/admin select" on public.attendance_plans;
drop policy if exists "attendance: select"               on public.attendance_plans;
drop policy if exists "attendance: insert own"           on public.attendance_plans;
drop policy if exists "attendance: update own"           on public.attendance_plans;
drop policy if exists "attendance: delete own"           on public.attendance_plans;

-- Unified SELECT: own OR managed team OR admin
create policy "attendance: select"
  on public.attendance_plans for select to authenticated
  using (
    exists (
      select 1 from public.users me
      where me.auth_user_id = (select auth.uid())
        and (
          me.id = public.attendance_plans.user_id
          or me.id in (
            select t.manager_user_id from public.teams t
            join public.users u on u.team_id = t.id
            where u.id = public.attendance_plans.user_id
          )
          or me.role in ('admin', 'system_admin')
        )
    )
  );

create policy "attendance: insert own"
  on public.attendance_plans for insert to authenticated
  with check (
    user_id in (select id from public.users where auth_user_id = (select auth.uid()))
  );

create policy "attendance: update own"
  on public.attendance_plans for update to authenticated
  using  (user_id in (select id from public.users where auth_user_id = (select auth.uid())))
  with check (user_id in (select id from public.users where auth_user_id = (select auth.uid())));

create policy "attendance: delete own"
  on public.attendance_plans for delete to authenticated
  using (user_id in (select id from public.users where auth_user_id = (select auth.uid())));


-- ═══════════════════════════════════════════════════════════
-- APPROVAL REQUESTS
-- Consolidates requester-select + approver-all into 1 SELECT.
-- ═══════════════════════════════════════════════════════════

drop policy if exists "approvals: requester read own"    on public.approval_requests;
drop policy if exists "approvals: approver/admin all"    on public.approval_requests;
drop policy if exists "approvals: select"                on public.approval_requests;
drop policy if exists "approvals: approver/admin insert" on public.approval_requests;
drop policy if exists "approvals: approver/admin update" on public.approval_requests;
drop policy if exists "approvals: admin delete"          on public.approval_requests;

-- Unified SELECT: requester, assigned approver, or admin/approver role
create policy "approvals: select"
  on public.approval_requests for select to authenticated
  using (
    requester_user_id in (select id from public.users where auth_user_id = (select auth.uid()))
    or approver_user_id in (select id from public.users where auth_user_id = (select auth.uid()))
    or exists (
      select 1 from public.users
      where auth_user_id = (select auth.uid())
        and role in ('admin', 'system_admin', 'approver')
    )
  );

create policy "approvals: approver/admin insert"
  on public.approval_requests for insert to authenticated
  with check (
    exists (
      select 1 from public.users
      where auth_user_id = (select auth.uid())
        and role in ('admin', 'system_admin', 'approver')
    )
  );

create policy "approvals: approver/admin update"
  on public.approval_requests for update to authenticated
  using (
    approver_user_id in (select id from public.users where auth_user_id = (select auth.uid()))
    or exists (
      select 1 from public.users
      where auth_user_id = (select auth.uid())
        and role in ('admin', 'system_admin', 'approver')
    )
  )
  with check (
    approver_user_id in (select id from public.users where auth_user_id = (select auth.uid()))
    or exists (
      select 1 from public.users
      where auth_user_id = (select auth.uid())
        and role in ('admin', 'system_admin', 'approver')
    )
  );

create policy "approvals: admin delete"
  on public.approval_requests for delete to authenticated
  using (
    exists (
      select 1 from public.users
      where auth_user_id = (select auth.uid())
        and role in ('admin', 'system_admin')
    )
  );


-- ═══════════════════════════════════════════════════════════
-- AUDIT EVENTS
-- ═══════════════════════════════════════════════════════════

drop policy if exists "audit: admin read" on public.audit_events;

create policy "audit: admin read"
  on public.audit_events for select to authenticated
  using (
    exists (
      select 1 from public.users
      where auth_user_id = (select auth.uid())
        and role in ('admin', 'system_admin')
    )
  );


-- ═══════════════════════════════════════════════════════════
-- NOTIFICATION PREFERENCES
-- ═══════════════════════════════════════════════════════════

drop policy if exists "notif_prefs: own row" on public.notification_preferences;
drop policy if exists "notif_prefs: select"  on public.notification_preferences;
drop policy if exists "notif_prefs: insert"  on public.notification_preferences;
drop policy if exists "notif_prefs: update"  on public.notification_preferences;

create policy "notif_prefs: select"
  on public.notification_preferences for select to authenticated
  using (user_id in (select id from public.users where auth_user_id = (select auth.uid())));

create policy "notif_prefs: insert"
  on public.notification_preferences for insert to authenticated
  with check (user_id in (select id from public.users where auth_user_id = (select auth.uid())));

create policy "notif_prefs: update"
  on public.notification_preferences for update to authenticated
  using  (user_id in (select id from public.users where auth_user_id = (select auth.uid())))
  with check (user_id in (select id from public.users where auth_user_id = (select auth.uid())));


-- ═══════════════════════════════════════════════════════════
-- NOTIFICATION SCHEDULES
-- ═══════════════════════════════════════════════════════════

drop policy if exists "notif_schedules: admin write"  on public.notification_schedules;
drop policy if exists "notif_schedules: read own org" on public.notification_schedules;
drop policy if exists "notif_schedules: select"       on public.notification_schedules;
drop policy if exists "notif_schedules: admin insert" on public.notification_schedules;
drop policy if exists "notif_schedules: admin update" on public.notification_schedules;
drop policy if exists "notif_schedules: admin delete" on public.notification_schedules;

create policy "notif_schedules: select"
  on public.notification_schedules for select to authenticated
  using (
    organisation_id in (
      select organisation_id from public.users
      where auth_user_id = (select auth.uid())
    )
  );

create policy "notif_schedules: admin insert"
  on public.notification_schedules for insert to authenticated
  with check (
    organisation_id in (
      select organisation_id from public.users
      where auth_user_id = (select auth.uid())
        and role in ('admin', 'system_admin')
    )
  );

create policy "notif_schedules: admin update"
  on public.notification_schedules for update to authenticated
  using (
    organisation_id in (
      select organisation_id from public.users
      where auth_user_id = (select auth.uid())
        and role in ('admin', 'system_admin')
    )
  )
  with check (
    organisation_id in (
      select organisation_id from public.users
      where auth_user_id = (select auth.uid())
        and role in ('admin', 'system_admin')
    )
  );

create policy "notif_schedules: admin delete"
  on public.notification_schedules for delete to authenticated
  using (
    organisation_id in (
      select organisation_id from public.users
      where auth_user_id = (select auth.uid())
        and role in ('admin', 'system_admin')
    )
  );


-- ═══════════════════════════════════════════════════════════
-- MISSING FK INDEXES
-- ═══════════════════════════════════════════════════════════

create index if not exists idx_approval_requests_approver
  on public.approval_requests(approver_user_id);

create index if not exists idx_attendance_linked_booking
  on public.attendance_plans(linked_booking_id);

create index if not exists idx_bookings_cancelled_by
  on public.bookings(cancelled_by_user_id);

create index if not exists idx_teams_manager
  on public.teams(manager_user_id);

create index if not exists idx_users_primary_office
  on public.users(primary_office_id);

create index if not exists idx_workspace_assets_restricted_team
  on public.workspace_assets(restricted_team_id);

create index if not exists idx_workspace_assets_restricted_user
  on public.workspace_assets(restricted_user_id);
