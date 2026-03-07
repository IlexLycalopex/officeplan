-- Migration 007: Approval Requests

create type public.approval_status as enum ('pending', 'approved', 'rejected', 'withdrawn');
create type public.request_type as enum ('advance_booking', 'restricted_asset', 'exception');

create table public.approval_requests (
  id uuid primary key default gen_random_uuid(),
  request_type public.request_type not null,
  target_booking_id uuid references public.bookings(id) on delete cascade,
  requester_user_id uuid not null references public.users(id) on delete cascade,
  approver_user_id uuid references public.users(id) on delete set null,
  status public.approval_status not null default 'pending',
  rationale text,
  decision_notes text,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_approvals_requester on public.approval_requests(requester_user_id);
create index idx_approvals_status on public.approval_requests(status);
create index idx_approvals_booking on public.approval_requests(target_booking_id);

alter table public.approval_requests enable row level security;

create policy "approvals: requester read own"
  on public.approval_requests for select to authenticated
  using (
    requester_user_id in (select id from public.users where auth_user_id = auth.uid())
  );

create policy "approvals: approver/admin all"
  on public.approval_requests for all to authenticated
  using (
    approver_user_id in (select id from public.users where auth_user_id = auth.uid())
    or exists (
      select 1 from public.users where auth_user_id = auth.uid()
        and role in ('admin', 'system_admin', 'approver')
    )
  );

create trigger approval_requests_updated_at before update on public.approval_requests
  for each row execute function public.set_updated_at();

-- Approve / reject RPC
create or replace function public.fn_decide_approval(
  p_request_id uuid,
  p_decision public.approval_status,
  p_notes text default null
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_me users%rowtype;
  v_request approval_requests%rowtype;
  v_new_booking_status booking_status;
begin
  select * into v_me from public.users where auth_user_id = auth.uid();
  if v_me.role not in ('admin', 'system_admin', 'approver') then
    return jsonb_build_object('error', 'Not authorised to decide approvals');
  end if;

  select * into v_request from public.approval_requests where id = p_request_id;
  if not found or v_request.status != 'pending' then
    return jsonb_build_object('error', 'Request not found or already decided');
  end if;

  if p_decision not in ('approved', 'rejected') then
    return jsonb_build_object('error', 'Decision must be approved or rejected');
  end if;

  update public.approval_requests
  set status = p_decision,
      approver_user_id = v_me.id,
      decision_notes = p_notes,
      decided_at = now(),
      updated_at = now()
  where id = p_request_id;

  -- Update linked booking status
  v_new_booking_status := case when p_decision = 'approved' then 'confirmed'::booking_status
                               else 'rejected'::booking_status end;

  if v_request.target_booking_id is not null then
    update public.bookings
    set status = v_new_booking_status, updated_at = now()
    where id = v_request.target_booking_id;
  end if;

  insert into public.audit_events (actor_user_id, entity_type, entity_id, action_type, payload_json)
  values (v_me.id, 'approval_request', p_request_id, p_decision::text,
    jsonb_build_object('notes', p_notes, 'booking_id', v_request.target_booking_id));

  return jsonb_build_object('success', true, 'booking_status', v_new_booking_status);
end;
$$;
