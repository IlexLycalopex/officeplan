-- Migration 019: extend bookings SELECT policy for org-wide visibility
--
-- Previously, regular employees could only see their own bookings.
-- This meant the floor map and meeting room timeline showed every
-- desk/room as available (green) because all other users' bookings
-- were filtered out by RLS before reaching the client.
--
-- Fix: add a fourth condition allowing all org members to read booking
-- records for assets that belong to their organisation. This is required
-- for the floor map, room availability timeline, and team view to work.

DROP POLICY IF EXISTS "bookings: select" ON public.bookings;

CREATE POLICY "bookings: select" ON public.bookings
  FOR SELECT USING (
    -- Own bookings
    user_id = fn_user_id()
    OR
    -- Admins see everything in their org
    fn_user_is_admin()
    OR
    -- Managers see their direct reports' bookings
    fn_user_id() IN (
      SELECT t.manager_user_id
      FROM teams t
      JOIN users u ON u.team_id = t.id
      WHERE u.id = bookings.user_id
    )
    OR
    -- All org members can see booking status for org assets (floor map / room timeline)
    asset_id IN (
      SELECT wa.id
      FROM workspace_assets wa
      JOIN floors f ON f.id = wa.floor_id
      JOIN offices o ON o.id = f.office_id
      WHERE o.organisation_id = fn_user_org_id()
    )
  );
