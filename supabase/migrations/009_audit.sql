-- Migration 009: Audit events

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references public.users(id) on delete set null,
  entity_type text not null,   -- 'booking', 'approval_request', 'user', 'workspace_asset', etc.
  entity_id uuid,
  action_type text not null,   -- 'created', 'updated', 'cancelled', 'approved', 'rejected', etc.
  event_time timestamptz not null default now(),
  payload_json jsonb
);

create index idx_audit_entity on public.audit_events(entity_type, entity_id);
create index idx_audit_actor on public.audit_events(actor_user_id);
create index idx_audit_time on public.audit_events(event_time desc);

-- RLS: admins read; inserts done via security-definer functions only
alter table public.audit_events enable row level security;

create policy "audit: admin read"
  on public.audit_events for select to authenticated
  using (
    exists (
      select 1 from public.users
      where auth_user_id = auth.uid()
        and role in ('admin', 'system_admin')
    )
  );

-- No direct insert policy — all inserts via security definer RPCs
