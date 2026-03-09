-- Migration 020: fix fn_create_booking — v_status must be booking_status enum, not text.
--
-- PostgreSQL will not implicitly cast a text VARIABLE to a user-defined enum type,
-- causing: "column status is of type booking_status but expression is of type text"
-- which PostgREST surfaces as HTTP 400 on every booking attempt.
--
-- String LITERALS ('confirmed', 'pending_approval') are fine — Postgres casts those
-- automatically. Only named variables of the wrong type cause this failure.
--
-- Fix: redeclare v_status as booking_status (the actual column enum type).

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
  v_asset            workspace_assets%ROWTYPE;
  v_caller_org_id    uuid;
  v_caller_user_id   uuid;
  v_booking_id       uuid;
  v_status           booking_status;          -- ← enum type, not text
  v_days_ahead       integer;
  v_self_book_window integer;
  v_max_window       integer;
  v_policy           policies%ROWTYPE;
  v_closed_reason    text;
  v_office_id        uuid;
BEGIN
  v_caller_user_id := fn_user_id();
  v_caller_org_id  := fn_user_org_id();

  IF v_caller_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

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

  SELECT office_id INTO v_office_id FROM floors WHERE id = v_asset.floor_id;

  SELECT * INTO v_policy FROM policies WHERE organisation_id = v_caller_org_id;
  v_self_book_window := COALESCE(v_policy.self_book_window_days, 14);
  v_max_window       := COALESCE(v_policy.max_booking_window_days, 180);

  v_days_ahead := (p_booking_date - CURRENT_DATE);
  IF v_days_ahead < 0 THEN
    RETURN jsonb_build_object('error', 'Cannot book in the past');
  END IF;
  IF v_days_ahead > v_max_window THEN
    RETURN jsonb_build_object('error', format('Booking too far ahead (max %s days)', v_max_window));
  END IF;

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

  IF p_start_time IS NOT NULL AND p_end_time IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM bookings
      WHERE asset_id = p_asset_id
        AND booking_date = p_booking_date
        AND status IN ('confirmed', 'pending_approval')
        AND start_time IS NOT NULL AND end_time IS NOT NULL
        AND start_time < p_end_time AND end_time > p_start_time
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

  IF v_days_ahead <= v_self_book_window THEN
    v_status := 'confirmed';
  ELSE
    v_status := 'pending_approval';
  END IF;

  INSERT INTO bookings (
    asset_id, user_id, booking_date,
    start_time, end_time, notes, status, source
  )
  VALUES (
    p_asset_id, p_user_id, p_booking_date,
    p_start_time, p_end_time, p_notes, v_status, 'user'
  )
  RETURNING id INTO v_booking_id;

  IF v_status = 'pending_approval' THEN
    INSERT INTO approval_requests (
      request_type, target_booking_id, requester_user_id, status
    )
    VALUES ('advance_booking', v_booking_id, p_user_id, 'pending');
  END IF;

  INSERT INTO audit_events (actor_user_id, entity_type, entity_id, action_type, payload_json)
  VALUES (
    v_caller_user_id, 'booking', v_booking_id, 'created',
    jsonb_build_object('status', v_status, 'date', p_booking_date, 'asset_id', p_asset_id)
  );

  RETURN jsonb_build_object('booking_id', v_booking_id, 'status', v_status);
END;
$$;
