-- Migration 017: per-org booking policies table
-- Stores configurable booking rules; fn_create_booking reads from here
-- instead of using hardcoded values.

CREATE TABLE IF NOT EXISTS public.policies (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id           uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  self_book_window_days     integer NOT NULL DEFAULT 14,
  max_booking_window_days   integer NOT NULL DEFAULT 180,
  cancellation_cutoff_hours integer NOT NULL DEFAULT 0,
  working_days              integer[] NOT NULL DEFAULT '{1,2,3,4,5}',
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organisation_id)
);

ALTER TABLE public.policies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "policies_select_org_members" ON public.policies
  FOR SELECT USING (organisation_id = fn_user_org_id());

CREATE POLICY "policies_write_admins" ON public.policies
  FOR ALL USING (organisation_id = fn_user_org_id() AND fn_user_is_admin())
  WITH CHECK (organisation_id = fn_user_org_id() AND fn_user_is_admin());

-- Seed default row for the Acme org
INSERT INTO public.policies (organisation_id, self_book_window_days, max_booking_window_days, cancellation_cutoff_hours, working_days)
VALUES ('11111111-0000-0000-0000-000000000001', 14, 180, 0, '{1,2,3,4,5}')
ON CONFLICT (organisation_id) DO NOTHING;

-- Update fn_create_booking to read booking windows from policies table
-- and to check closed_dates (added in migration 018).
CREATE OR REPLACE FUNCTION public.fn_create_booking(
  p_asset_id     uuid,
  p_user_id      uuid,
  p_booking_date date,
  p_start_time   time DEFAULT NULL,
  p_end_time     time DEFAULT NULL,
  p_notes        text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_asset           workspace_assets%ROWTYPE;
  v_floor           floors%ROWTYPE;
  v_caller_org_id   uuid;
  v_caller_user_id  uuid;
  v_booking_id      uuid;
  v_status          text;
  v_days_ahead      integer;
  v_self_book_window integer;
  v_max_window       integer;
  v_policy          policies%ROWTYPE;
  v_closed_reason   text;
  v_office_id       uuid;
BEGIN
  -- Resolve caller
  v_caller_user_id := fn_user_id();
  v_caller_org_id  := fn_user_org_id();

  IF v_caller_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  -- Load asset
  SELECT * INTO v_asset FROM workspace_assets WHERE id = p_asset_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Asset not found');
  END IF;
  IF v_asset.is_draft THEN
    RETURN jsonb_build_object('error', 'Asset is not published');
  END IF;
  IF v_asset.status NOT IN ('available', 'restricted') THEN
    RETURN jsonb_build_object('error', 'Asset is not available for booking');
  END IF;

  -- Resolve office for closed-date check
  SELECT office_id INTO v_office_id FROM floors WHERE id = v_asset.floor_id;

  -- Load policy (fall back to defaults if missing)
  SELECT * INTO v_policy FROM policies WHERE organisation_id = v_caller_org_id;
  v_self_book_window := COALESCE(v_policy.self_book_window_days, 14);
  v_max_window       := COALESCE(v_policy.max_booking_window_days, 180);

  -- Booking window checks
  v_days_ahead := (p_booking_date - CURRENT_DATE);
  IF v_days_ahead < 0 THEN
    RETURN jsonb_build_object('error', 'Cannot book in the past');
  END IF;
  IF v_days_ahead > v_max_window THEN
    RETURN jsonb_build_object('error', format('Booking too far ahead (max %s days)', v_max_window));
  END IF;

  -- Closed-date check
  SELECT reason INTO v_closed_reason
  FROM closed_dates
  WHERE organisation_id = v_caller_org_id
    AND close_date = p_booking_date
    AND (office_id IS NULL OR office_id = v_office_id)
  LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'error',
      CASE WHEN v_closed_reason IS NOT NULL
        THEN format('Office is closed on this date: %s', v_closed_reason)
        ELSE 'Office is closed on this date'
      END
    );
  END IF;

  -- Restriction checks
  IF v_asset.restriction_type = 'named_user' THEN
    IF v_asset.restricted_user_id IS DISTINCT FROM p_user_id THEN
      RETURN jsonb_build_object('error', 'This asset is restricted to a specific user');
    END IF;
  ELSIF v_asset.restriction_type = 'team' THEN
    IF NOT EXISTS (
      SELECT 1 FROM users WHERE id = p_user_id AND team_id = v_asset.restricted_team_id
    ) THEN
      RETURN jsonb_build_object('error', 'This asset is restricted to a specific team');
    END IF;
  ELSIF v_asset.restriction_type = 'admin_only' THEN
    IF NOT fn_user_is_admin() THEN
      RETURN jsonb_build_object('error', 'This asset is for admin use only');
    END IF;
  END IF;

  -- Conflict: asset already booked for this date/time
  IF p_start_time IS NOT NULL AND p_end_time IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM bookings
      WHERE asset_id = p_asset_id
        AND booking_date = p_booking_date
        AND status IN ('confirmed', 'pending_approval')
        AND start_time IS NOT NULL
        AND end_time IS NOT NULL
        AND start_time < p_end_time
        AND end_time > p_start_time
    ) THEN
      RETURN jsonb_build_object('error', 'Asset already booked for this time slot');
    END IF;
  ELSE
    IF EXISTS (
      SELECT 1 FROM bookings
      WHERE asset_id = p_asset_id
        AND booking_date = p_booking_date
        AND status IN ('confirmed', 'pending_approval')
        AND (start_time IS NULL OR p_start_time IS NULL)
    ) THEN
      RETURN jsonb_build_object('error', 'Asset already booked for this date');
    END IF;
  END IF;

  -- Self-conflict: user already has a desk booking same day (only for desks)
  IF v_asset.asset_type = 'desk' THEN
    IF EXISTS (
      SELECT 1 FROM bookings b
      JOIN workspace_assets wa ON wa.id = b.asset_id
      WHERE b.user_id = p_user_id
        AND b.booking_date = p_booking_date
        AND b.status IN ('confirmed', 'pending_approval')
        AND wa.asset_type = 'desk'
    ) THEN
      RETURN jsonb_build_object('error', 'You already have a desk booking on this date');
    END IF;
  END IF;

  -- Determine status
  IF v_days_ahead <= v_self_book_window THEN
    v_status := 'confirmed';
  ELSE
    v_status := 'pending_approval';
  END IF;

  -- Insert booking
  INSERT INTO bookings (
    asset_id, user_id, booking_date,
    start_time, end_time, notes, status, source
  )
  VALUES (
    p_asset_id, p_user_id, p_booking_date,
    p_start_time, p_end_time, p_notes, v_status, 'user'
  )
  RETURNING id INTO v_booking_id;

  -- Create approval request if needed
  IF v_status = 'pending_approval' THEN
    INSERT INTO approval_requests (
      request_type, target_booking_id, requester_user_id, status
    )
    VALUES ('advance_booking', v_booking_id, p_user_id, 'pending');
  END IF;

  -- Audit
  INSERT INTO audit_events (actor_user_id, entity_type, entity_id, action_type, payload_json)
  VALUES (
    v_caller_user_id, 'booking', v_booking_id, 'created',
    jsonb_build_object('status', v_status, 'date', p_booking_date, 'asset_id', p_asset_id)
  );

  RETURN jsonb_build_object('booking_id', v_booking_id, 'status', v_status);
END;
$$;
