-- Migration 012: Fix auth user linking
-- Problem: handle_new_auth_user() always INSERTs a new profile row even when a
-- pre-seeded public.users row already exists with the same email and
-- auth_user_id IS NULL. This created a duplicate employee row and left the
-- admin row unlinked, causing GoTrue to fail on re-login (missing identity).
--
-- KEY LESSON: Never manually insert rows into auth.users or auth.identities.
-- GoTrue v2 requires instance_id = '00000000-0000-0000-0000-000000000000' and
-- a properly created identity. Manual inserts cause "Database error finding user"
-- on OTP requests. Instead: reset auth_user_id to NULL and let GoTrue create
-- the auth user on first login — the trigger will re-link it.

-- Fix 1: Update trigger to UPDATE existing unlinked rows before INSERT
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  default_org_id uuid;
  rows_updated    int;
BEGIN
  SELECT id INTO default_org_id FROM public.organisations LIMIT 1;

  IF default_org_id IS NULL THEN
    RETURN new;
  END IF;

  -- Link any pre-seeded user row with the same email (auth_user_id IS NULL = manually inserted)
  UPDATE public.users
  SET auth_user_id = new.id
  WHERE email = new.email
    AND auth_user_id IS NULL
    AND organisation_id = default_org_id;

  GET DIAGNOSTICS rows_updated = ROW_COUNT;

  -- Only create a new profile row if no existing row was linked
  IF rows_updated = 0 THEN
    INSERT INTO public.users (auth_user_id, organisation_id, email, first_name, last_name)
    VALUES (new.id, default_org_id, new.email, split_part(new.email, '@', 1), '')
    ON CONFLICT (auth_user_id) DO NOTHING;
  END IF;

  RETURN new;
END;
$$;

-- Fix 2: Delete the duplicate employee row created by the old trigger
-- (idempotent: no-op if already gone)
DELETE FROM public.users
WHERE id = '9c246999-686b-4fec-a8fb-5cf1bd7b0503';

-- Fix 3: Delete any manually-created auth records for the admin email so GoTrue
-- can create them properly on first login (instance_id, identity format, etc.)
DELETE FROM auth.identities
WHERE user_id IN (
  SELECT id FROM auth.users WHERE email = 'alexander.jameswatts@gmail.com'
) AND last_sign_in_at IS NULL;  -- only delete never-used identities

DELETE FROM auth.users
WHERE email = 'alexander.jameswatts@gmail.com'
  AND instance_id IS NULL;  -- only delete manually-inserted rows (GoTrue always sets instance_id)

-- Fix 4: Reset auth_user_id to NULL on the admin public.users row so the trigger
-- will re-link it when GoTrue creates the auth user on first login.
UPDATE public.users
SET auth_user_id = NULL
WHERE email = 'alexander.jameswatts@gmail.com'
  AND NOT EXISTS (
    SELECT 1 FROM auth.users WHERE email = 'alexander.jameswatts@gmail.com'
  );
