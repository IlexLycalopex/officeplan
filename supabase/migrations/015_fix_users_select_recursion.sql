-- Migration 015: Fix users SELECT policy recursion (intermediate step)
-- The merged "users: select" policy from migration 013 causes infinite recursion
-- because the OR branch's subquery into public.users re-triggers the same policy.
-- Split into two policies: a direct auth_user_id check (no recursion) plus an org-scoped one.
-- NOTE: The org-scoped subquery still causes 2-level recursion when triggered from other
-- tables' policies — fully resolved in migration 016.

drop policy if exists "users: select" on public.users;

create policy "users: select own row"
  on public.users for select to authenticated
  using (auth_user_id = (select auth.uid()));

create policy "users: select org members"
  on public.users for select to authenticated
  using (
    organisation_id in (
      select organisation_id from public.users u2
      where u2.auth_user_id = (select auth.uid())
    )
  );
