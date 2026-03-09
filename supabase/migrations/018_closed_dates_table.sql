-- Migration 018: office closed dates
-- Allows admins to mark specific dates as closed (org-wide or per-office).
-- fn_create_booking (updated in 017) rejects bookings on closed dates.

CREATE TABLE IF NOT EXISTS public.closed_dates (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  office_id       uuid REFERENCES public.offices(id) ON DELETE CASCADE,  -- NULL = all offices
  close_date      date NOT NULL,
  reason          text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.closed_dates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "closed_dates_select_org_members" ON public.closed_dates
  FOR SELECT USING (organisation_id = fn_user_org_id());

CREATE POLICY "closed_dates_write_admins" ON public.closed_dates
  FOR ALL USING (organisation_id = fn_user_org_id() AND fn_user_is_admin())
  WITH CHECK (organisation_id = fn_user_org_id() AND fn_user_is_admin());
