import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/stores/authStore'
import type { Tables } from '@/types/database'
import { toISODate, getWeekStart, getWeekDays } from '@/lib/dateUtils'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any

export type TimesheetRow = Tables<'timesheets'>

export type TimesheetWithLocation = TimesheetRow & {
  offices: { id: string; name: string } | null
}

export type ShiftAmendmentRow = Tables<'shift_amendments'>

/** Save / submit payload for creating or updating a timesheet */
export interface TimesheetPayload {
  shift_date: string
  start_time: string
  end_time: string
  break_duration_minutes: number
  location_id: string | null
  notes: string | null
}

// ── My Timesheets ──────────────────────────────────────────────────────────────

/**
 * Fetch timesheets for the current user in the given week.
 * weekStart must be a Monday (ISO date string "YYYY-MM-DD").
 */
export function useMyWeekTimesheets(weekStart: Date) {
  const { profile } = useAuth()
  const days = getWeekDays(weekStart)
  const from = toISODate(days[0])
  const to = toISODate(days[6])

  return useQuery({
    queryKey: ['timesheets', 'mine', from],
    enabled: !!profile,
    queryFn: async (): Promise<TimesheetWithLocation[]> => {
      const { data, error } = await sb
        .from('timesheets')
        .select('*, offices(id, name)')
        .eq('staff_id', profile!.id)
        .is('deleted_at', null)
        .gte('shift_date', from)
        .lte('shift_date', to)
        .order('shift_date')
      if (error) throw error
      return (data ?? []) as TimesheetWithLocation[]
    },
  })
}

/**
 * Fetch all non-deleted timesheets for the current user (for history view).
 */
export function useMyTimesheets(limit = 50) {
  const { profile } = useAuth()

  return useQuery({
    queryKey: ['timesheets', 'mine', 'all', limit],
    enabled: !!profile,
    queryFn: async (): Promise<TimesheetWithLocation[]> => {
      const { data, error } = await sb
        .from('timesheets')
        .select('*, offices(id, name)')
        .eq('staff_id', profile!.id)
        .is('deleted_at', null)
        .order('shift_date', { ascending: false })
        .limit(limit)
      if (error) throw error
      return (data ?? []) as TimesheetWithLocation[]
    },
  })
}

/** Create a new timesheet entry in 'draft' status */
export function useCreateTimesheet() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: TimesheetPayload) => {
      const { data, error } = await sb
        .from('timesheets')
        .insert({ ...payload, status: 'draft' })
        .select()
        .single()
      if (error) throw error
      return data as TimesheetRow
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['timesheets'] }),
  })
}

/** Update an existing draft timesheet */
export function useUpdateTimesheet() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      ...payload
    }: { id: string } & TimesheetPayload) => {
      const { error } = await sb
        .from('timesheets')
        .update(payload)
        .eq('id', id)
        .eq('status', 'draft')
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['timesheets'] }),
  })
}

/** Submit a draft timesheet for manager approval */
export function useSubmitTimesheet() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb
        .from('timesheets')
        .update({ status: 'submitted', submitted_at: new Date().toISOString() })
        .eq('id', id)
        .eq('status', 'draft')
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['timesheets'] }),
  })
}

/** Soft-delete a timesheet (sets deleted_at) */
export function useDeleteTimesheet() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb
        .from('timesheets')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id)
        .in('status', ['draft', 'rejected'])
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['timesheets'] }),
  })
}

// ── Manager / Admin views ──────────────────────────────────────────────────────

export type TimesheetWithStaff = TimesheetRow & {
  users: { id: string; first_name: string; last_name: string; job_title: string | null } | null
  offices: { id: string; name: string } | null
}

/**
 * Fetch timesheets pending approval (submitted status).
 * Accessible to managers and admins via RLS.
 */
export function usePendingTimesheets() {
  return useQuery({
    queryKey: ['timesheets', 'pending'],
    queryFn: async (): Promise<TimesheetWithStaff[]> => {
      const { data, error } = await sb
        .from('timesheets')
        .select('*, users(id, first_name, last_name, job_title), offices(id, name)')
        .eq('status', 'submitted')
        .is('deleted_at', null)
        .order('submitted_at')
      if (error) throw error
      return (data ?? []) as TimesheetWithStaff[]
    },
  })
}

/**
 * Fetch all timesheets for a given week (manager view across all staff).
 */
export function useWeekTimesheets(weekStart: Date) {
  const days = getWeekDays(weekStart)
  const from = toISODate(days[0])
  const to = toISODate(days[6])

  return useQuery({
    queryKey: ['timesheets', 'week', from],
    queryFn: async (): Promise<TimesheetWithStaff[]> => {
      const { data, error } = await sb
        .from('timesheets')
        .select('*, users(id, first_name, last_name, job_title), offices(id, name)')
        .gte('shift_date', from)
        .lte('shift_date', to)
        .is('deleted_at', null)
        .order('shift_date')
        .order('users(last_name)')
      if (error) throw error
      return (data ?? []) as TimesheetWithStaff[]
    },
  })
}

/** Approve a submitted timesheet */
export function useApproveTimesheet() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, approvedBy }: { id: string; approvedBy: string }) => {
      const { error } = await sb
        .from('timesheets')
        .update({
          status: 'approved',
          approved_at: new Date().toISOString(),
          approved_by: approvedBy,
        })
        .eq('id', id)
        .eq('status', 'submitted')
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['timesheets'] }),
  })
}

/** Reject a submitted timesheet with a reason */
export function useRejectTimesheet() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      rejectedBy,
      reason,
    }: {
      id: string
      rejectedBy: string
      reason: string
    }) => {
      const { error } = await sb
        .from('timesheets')
        .update({
          status: 'rejected',
          rejected_at: new Date().toISOString(),
          rejected_by: rejectedBy,
          rejection_reason: reason,
        })
        .eq('id', id)
        .eq('status', 'submitted')
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['timesheets'] }),
  })
}

// ── Amendments ────────────────────────────────────────────────────────────────

/** Fetch the amendment history for a specific timesheet */
export function useTimesheetAmendments(timesheetId: string | null) {
  return useQuery({
    queryKey: ['timesheets', 'amendments', timesheetId],
    enabled: !!timesheetId,
    queryFn: async (): Promise<ShiftAmendmentRow[]> => {
      const { data, error } = await sb
        .from('shift_amendments')
        .select('*')
        .eq('timesheet_id', timesheetId)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as ShiftAmendmentRow[]
    },
  })
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Get the week start (Monday) for a given timesheet date */
export function timesheetWeekStart(ts: TimesheetRow): Date {
  return getWeekStart(new Date(ts.shift_date + 'T00:00:00'))
}

/** Status badge colours */
export const TIMESHEET_STATUS_COLOURS: Record<TimesheetRow['status'], string> = {
  draft: 'bg-gray-100 text-gray-600',
  submitted: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  amended: 'bg-blue-100 text-blue-700',
}

export const TIMESHEET_STATUS_LABELS: Record<TimesheetRow['status'], string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  approved: 'Approved',
  rejected: 'Rejected',
  amended: 'Amended',
}
