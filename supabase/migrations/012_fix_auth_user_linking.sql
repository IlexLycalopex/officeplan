-- Migration 012: Fix auth user linking
-- Problem: handle_new_auth_user() always INSERTs a new profile row even when a
-- pre-seeded public.users row already exists with the same email and
-- auth_user_id IS NULL. This created a duplicate employee row and left the
-- admin row unlinked, causing GoTrue to fail on re-login (missing identity).

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

-- Fix 3: Link the admin public.users row to the existing auth.users entry
UPDATE public.users
SET auth_user_id = 'cfebd47a-36ae-4699-b5a0-1271ac93f3c2'
WHERE id = 'cfebd47a-36ae-4699-b5a0-1271ac93f3c2'
  AND auth_user_id IS NULL;

-- Fix 4: Insert the missing auth.identities row so GoTrue can authenticate
-- Without this GoTrue treats the user as "unfinished" and fails on re-login
-- Note: email is a generated column in auth.identities — must be omitted
INSERT INTO auth.identities (
  provider_id, user_id, identity_data, provider,
  created_at, updated_at
)
VALUES (
  'alexander.jameswatts@gmail.com',
  'cfebd47a-36ae-4699-b5a0-1271ac93f3c2',
  jsonb_build_object(
    'sub',            'cfebd47a-36ae-4699-b5a0-1271ac93f3c2',
    'email',          'alexander.jameswatts@gmail.com',
    'email_verified', true,
    'phone_verified', false
  ),
  'email',
  now(), now()
)
ON CONFLICT DO NOTHING;
