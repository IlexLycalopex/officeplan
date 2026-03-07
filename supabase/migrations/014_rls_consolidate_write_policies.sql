-- Migration 014: Consolidate remaining multiple-permissive-policy warnings
--
-- Migration 013 split admin write policies into INSERT/UPDATE/DELETE to avoid
-- overlapping SELECT policies. This left two permissive INSERT policies and two
-- permissive UPDATE policies on bookings and users. This migration merges each
-- pair into a single combined policy using OR conditions.

-- ═══ BOOKINGS: INSERT ════════════════════════════════════════════════════
-- Merges "bookings: insert own" + "bookings: admin insert" → "bookings: insert"

drop policy if exists "bookings: insert own"   on public.bookings;
drop policy if exists "bookings: admin insert"  on public.bookings;
drop policy if exists "bookings: insert"        on public.bookings;

create policy "bookings: insert"
  on public.bookings for insert to authenticated
  with check (
    -- own booking
    user_id in (select id from public.users where auth_user_id = (select auth.uid()))
    -- or admin booking on behalf of someone
    or exists (
      select 1 from public.users
      where auth_user_id = (select auth.uid())
        and role in ('admin', 'system_admin')
    )
  );

-- ═══ BOOKINGS: UPDATE ════════════════════════════════════════════════════
-- Merges "bookings: update own" + "bookings: admin update" → "bookings: update"

drop policy if exists "bookings: update own"   on public.bookings;
drop policy if exists "bookings: admin update"  on public.bookings;
drop policy if exists "bookings: update"        on public.bookings;

create policy "bookings: update"
  on public.bookings for update to authenticated
  using (
    user_id in (select id from public.users where auth_user_id = (select auth.uid()))
    or exists (
      select 1 from public.users
      where auth_user_id = (select auth.uid())
        and role in ('admin', 'system_admin')
    )
  );

-- ═══ USERS: UPDATE ═══════════════════════════════════════════════════════
-- Merges "users: update own row" + "users: admin update" → "users: update"

drop policy if exists "users: update own row"  on public.users;
drop policy if exists "users: admin update"     on public.users;
drop policy if exists "users: update"           on public.users;

create policy "users: update"
  on public.users for update to authenticated
  using (
    -- own profile update
    auth_user_id = (select auth.uid())
    -- or admin updating any user in their org
    or organisation_id in (
      select organisation_id from public.users u2
      where u2.auth_user_id = (select auth.uid())
        and u2.role in ('admin', 'system_admin')
    )
  )
  with check (
    auth_user_id = (select auth.uid())
    or organisation_id in (
      select organisation_id from public.users u2
      where u2.auth_user_id = (select auth.uid())
        and u2.role in ('admin', 'system_admin')
    )
  );
