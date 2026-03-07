-- Seed data for OfficePlan pilot
-- Run AFTER all migrations
-- Creates: 1 org, 3 departments, 6 teams, sample offices/floors/assets
-- User accounts are created via auth (email sign-in); this seeds the reference data

-- Organisation
insert into public.organisations (id, name, slug) values
  ('11111111-0000-0000-0000-000000000001', 'Acme Professional Services', 'acme')
on conflict do nothing;

-- Departments
insert into public.departments (id, organisation_id, name, code) values
  ('22222222-0001-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001', 'Technology', 'TECH'),
  ('22222222-0002-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001', 'Client Services', 'CS'),
  ('22222222-0003-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001', 'Operations', 'OPS')
on conflict do nothing;

-- Offices
insert into public.offices (id, organisation_id, name, address, city, timezone) values
  ('33333333-0001-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001',
   'London HQ', '10 Finsbury Square', 'London', 'Europe/London'),
  ('33333333-0002-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001',
   'Manchester Office', '1 Spinningfields', 'Manchester', 'Europe/London')
on conflict do nothing;

-- Floors
insert into public.floors (id, office_id, name, sequence, width_units, height_units) values
  ('44444444-0001-0000-0000-000000000001', '33333333-0001-0000-0000-000000000001', 'Ground Floor', 1, 120, 80),
  ('44444444-0002-0000-0000-000000000001', '33333333-0001-0000-0000-000000000001', 'First Floor', 2, 120, 80),
  ('44444444-0003-0000-0000-000000000001', '33333333-0002-0000-0000-000000000001', 'Main Floor', 1, 80, 60)
on conflict do nothing;

-- Workspace assets — London Ground Floor (40 desks, 3 rooms)
-- Desks in a grid layout
insert into public.workspace_assets (floor_id, asset_type, code, name, x, y, width, height, status, is_draft) values
  -- Row A (y=5): desks 1-10
  ('44444444-0001-0000-0000-000000000001', 'desk', 'D-GF-001', 'Desk GF-001', 5, 5, 8, 5, 'available', false),
  ('44444444-0001-0000-0000-000000000001', 'desk', 'D-GF-002', 'Desk GF-002', 14, 5, 8, 5, 'available', false),
  ('44444444-0001-0000-0000-000000000001', 'desk', 'D-GF-003', 'Desk GF-003', 23, 5, 8, 5, 'available', false),
  ('44444444-0001-0000-0000-000000000001', 'desk', 'D-GF-004', 'Desk GF-004', 32, 5, 8, 5, 'available', false),
  ('44444444-0001-0000-0000-000000000001', 'desk', 'D-GF-005', 'Desk GF-005', 41, 5, 8, 5, 'available', false),
  ('44444444-0001-0000-0000-000000000001', 'desk', 'D-GF-006', 'Desk GF-006', 55, 5, 8, 5, 'available', false),
  ('44444444-0001-0000-0000-000000000001', 'desk', 'D-GF-007', 'Desk GF-007', 64, 5, 8, 5, 'available', false),
  ('44444444-0001-0000-0000-000000000001', 'desk', 'D-GF-008', 'Desk GF-008', 73, 5, 8, 5, 'available', false),
  ('44444444-0001-0000-0000-000000000001', 'desk', 'D-GF-009', 'Desk GF-009', 82, 5, 8, 5, 'available', false),
  ('44444444-0001-0000-0000-000000000001', 'desk', 'D-GF-010', 'Desk GF-010', 91, 5, 8, 5, 'available', false),
  -- Row B (y=15)
  ('44444444-0001-0000-0000-000000000001', 'desk', 'D-GF-011', 'Desk GF-011', 5, 15, 8, 5, 'available', false),
  ('44444444-0001-0000-0000-000000000001', 'desk', 'D-GF-012', 'Desk GF-012', 14, 15, 8, 5, 'available', false),
  ('44444444-0001-0000-0000-000000000001', 'desk', 'D-GF-013', 'Desk GF-013', 23, 15, 8, 5, 'available', false),
  ('44444444-0001-0000-0000-000000000001', 'desk', 'D-GF-014', 'Desk GF-014', 32, 15, 8, 5, 'available', false),
  ('44444444-0001-0000-0000-000000000001', 'desk', 'D-GF-015', 'Desk GF-015', 41, 15, 8, 5, 'available', false),
  ('44444444-0001-0000-0000-000000000001', 'desk', 'D-GF-016', 'Desk GF-016', 55, 15, 8, 5, 'available', false),
  ('44444444-0001-0000-0000-000000000001', 'desk', 'D-GF-017', 'Desk GF-017', 64, 15, 8, 5, 'available', false),
  ('44444444-0001-0000-0000-000000000001', 'desk', 'D-GF-018', 'Desk GF-018', 73, 15, 8, 5, 'available', false),
  ('44444444-0001-0000-0000-000000000001', 'desk', 'D-GF-019', 'Desk GF-019', 82, 15, 8, 5, 'available', false),
  ('44444444-0001-0000-0000-000000000001', 'desk', 'D-GF-020', 'Desk GF-020', 91, 15, 8, 5, 'available', false),
  -- Row C (y=30)
  ('44444444-0001-0000-0000-000000000001', 'desk', 'D-GF-021', 'Desk GF-021', 5, 30, 8, 5, 'available', false),
  ('44444444-0001-0000-0000-000000000001', 'desk', 'D-GF-022', 'Desk GF-022', 14, 30, 8, 5, 'available', false),
  ('44444444-0001-0000-0000-000000000001', 'desk', 'D-GF-023', 'Desk GF-023', 23, 30, 8, 5, 'available', false),
  ('44444444-0001-0000-0000-000000000001', 'desk', 'D-GF-024', 'Desk GF-024', 32, 30, 8, 5, 'available', false),
  ('44444444-0001-0000-0000-000000000001', 'desk', 'D-GF-025', 'Desk GF-025', 41, 30, 8, 5, 'available', false),
  ('44444444-0001-0000-0000-000000000001', 'desk', 'D-GF-026', 'Desk GF-026', 55, 30, 8, 5, 'available', false),
  ('44444444-0001-0000-0000-000000000001', 'desk', 'D-GF-027', 'Desk GF-027', 64, 30, 8, 5, 'available', false),
  ('44444444-0001-0000-0000-000000000001', 'desk', 'D-GF-028', 'Desk GF-028', 73, 30, 8, 5, 'available', false),
  ('44444444-0001-0000-0000-000000000001', 'desk', 'D-GF-029', 'Desk GF-029', 82, 30, 8, 5, 'available', false),
  ('44444444-0001-0000-0000-000000000001', 'desk', 'D-GF-030', 'Desk GF-030', 91, 30, 8, 5, 'available', false),
  -- Accessible / standing desks
  ('44444444-0001-0000-0000-000000000001', 'desk', 'D-GF-031', 'Standing Desk A', 5, 45, 10, 6, 'available', false),
  ('44444444-0001-0000-0000-000000000001', 'desk', 'D-GF-032', 'Accessible Desk', 16, 45, 10, 6, 'available', false),
  -- Meeting rooms
  ('44444444-0001-0000-0000-000000000001', 'room', 'R-GF-BOARD', 'Boardroom', 5, 55, 25, 18, 'available', false),
  ('44444444-0001-0000-0000-000000000001', 'room', 'R-GF-FOCUS1', 'Focus Room 1', 32, 55, 15, 18, 'available', false),
  ('44444444-0001-0000-0000-000000000001', 'room', 'R-GF-FOCUS2', 'Focus Room 2', 49, 55, 15, 18, 'available', false)
on conflict do nothing;

-- Update room capacities
update public.workspace_assets set capacity = 16 where code = 'R-GF-BOARD';
update public.workspace_assets set capacity = 4 where code = 'R-GF-FOCUS1';
update public.workspace_assets set capacity = 4 where code = 'R-GF-FOCUS2';

-- Update features
update public.workspace_assets set features = array['standing'] where code = 'D-GF-031';
update public.workspace_assets set features = array['accessible', 'height_adjustable'] where code = 'D-GF-032';
update public.workspace_assets set features = array['av', 'video_conf', 'whiteboard'] where code = 'R-GF-BOARD';
update public.workspace_assets set features = array['video_conf'] where code in ('R-GF-FOCUS1', 'R-GF-FOCUS2');

-- Default notification schedules
insert into public.notification_schedules (organisation_id, schedule_type, cron_expression, active_flag) values
  ('11111111-0000-0000-0000-000000000001', 'weekly_digest', '0 8 * * 1', true),  -- Mon 8am
  ('11111111-0000-0000-0000-000000000001', 'daily_digest', '0 7 * * 1-5', false) -- Weekdays 7am (disabled by default)
on conflict do nothing;
