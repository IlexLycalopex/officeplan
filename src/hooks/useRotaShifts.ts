import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/stores/authStore'
import type { Tables } from '@/types/database'
import { toISODate, getWeekDays } from '@/lib/dateUtils'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any

export type RotaShiftRow = Tables<'rota_shifts'>
export type RotaWeekRow = Tables<'rota_weeks'>
export type StaffUnavailabilityRow = Tables<'staff_unavailability'>
export type RotaShiftAckRow = Tables<'rota_shift_acknowledgements'>

export type RotaShiftWithStaff = RotaShiftRow & {
  users: { id: string; first_name: string; last_name: string; job_title: string | null } | null
  offices: { id: string; name: string } | null
}

export type RotaShiftWithDetails = RotaShiftRow & {
  offices: { id: string; name: string } | null
  rota_shift_acknowledgements: RotaShiftAckRow[]
}

export interface RotaShiftPayload {
  staff_id: string
  shift_date: string
  start_time: string
  end_time: string
  break_mins: number
  location_id: string | null
  notes: string | null
  status: 'draft' | 'tentative' | 'confirmed'
}

export const ROTA_STATUS_COLOURS: Record<RotaShiftRow['status'], string> = {
  draft: 'bg-gray-100 text-gray-600 border-gray-200',
  tentative: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  confirmed: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  cancelled: 'bg-red-100 text-red-600 border-red-200',
}

export const ROTA_STATUS_LABELS: Record<RotaShiftRow['status'], string> = {
  draft: 'Draft',
  tentative: 'Tentative',
  confirmed: 'Confirmed',
  cancelled: 'Cancelled',
}

// ── Week helper ────────────────────────────────────────────────────────────────

function weekRange(weekStart: Date) {
  const days = getWeekDays(weekStart)
  return { from: toISODate(days[0]), to: toISODate(days[6]) }
}

// ── Rota Week (lock record) ───────────────────────────────────────────────────

/**
 * Fetch the rota_weeks record for a given week start.
 * Returns null if no record exists yet (week is not yet published/locked).
 */
export function useRotaWeek(weekStart: Date) {
  const from = toISODate(weekStart)
  return useQuery({
    queryKey: ['rota-weeks', from],
    queryFn: async (): Promise<RotaWeekRow | null> => {
      const { data, error } = await sb
        .from('rota_weeks')
        .select('*')
        .eq('week_start', from)
        .maybeSingle()
      if (error) throw error
      return data as RotaWeekRow | null
    },
  })
}

// ── Shifts — Manager view ──────────────────────────────────────────────────────

/**
 * Fetch all rota shifts for a week (all staff). Used by the Rota Builder.
 */
export function useWeekRotaShifts(weekStart: Date) {
  const { from, to } = weekRange(weekStart)
  return useQuery({
    queryKey: ['rota-shifts', 'week', from],
    queryFn: async (): Promise<RotaShiftWithStaff[]> => {
      const { data, error } = await sb
        .from('rota_shifts')
        .select('*, users(id, first_name, last_name, job_title), offices(id, name)')
        .gte('shift_date', from)
        .lte('shift_date', to)
        .neq('status', 'cancelled')
        .order('shift_date')
        .order('start_time')
      if (error) throw error
      return (data ?? []) as RotaShiftWithStaff[]
    },
  })
}

// ── Shifts — Staff (my) view ──────────────────────────────────────────────────

/**
 * Fetch the current user's rota shifts for a week, including acknowledgements.
 */
export function useMyRotaShifts(weekStart: Date) {
  const { profile } = useAuth()
  const { from, to } = weekRange(weekStart)

  return useQuery({
    queryKey: ['rota-shifts', 'mine', from],
    enabled: !!profile,
    queryFn: async (): Promise<RotaShiftWithDetails[]> => {
      const { data, error } = await sb
        .from('rota_shifts')
        .select('*, offices(id, name), rota_shift_acknowledgements(*)')
        .eq('staff_id', profile!.id)
        .gte('shift_date', from)
        .lte('shift_date', to)
        .neq('status', 'cancelled')
        .order('shift_date')
        .order('start_time')
      if (error) throw error
      return (data ?? []) as RotaShiftWithDetails[]
    },
  })
}

// ── Mutations ─────────────────────────────────────────────────────────────────

export function useCreateRotaShift() {
  const qc = useQueryClient()
  const { profile } = useAuth()
  return useMutation({
    mutationFn: async (payload: RotaShiftPayload) => {
      const { data, error } = await sb
        .from('rota_shifts')
        .insert({ ...payload, created_by: profile?.id ?? null })
        .select()
        .single()
      if (error) throw error
      return data as RotaShiftRow
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rota-shifts'] }),
  })
}

export function useUpdateRotaShift() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      ...payload
    }: { id: string } & Partial<RotaShiftPayload>) => {
      const { error } = await sb.from('rota_shifts').update(payload).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rota-shifts'] }),
  })
}

export function useCancelRotaShift() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason?: string }) => {
      const { error } = await sb
        .from('rota_shifts')
        .update({ status: 'cancelled', cancellation_reason: reason ?? null })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rota-shifts'] }),
  })
}

/**
 * Publish (confirm) all draft/tentative shifts for a week.
 * Sets status = 'confirmed' and published_at/published_by.
 */
export function usePublishWeekShifts() {
  const qc = useQueryClient()
  const { profile } = useAuth()
  return useMutation({
    mutationFn: async (weekStart: Date) => {
      const { from, to } = weekRange(weekStart)
      const { error } = await sb
        .from('rota_shifts')
        .update({
          status: 'confirmed',
          published_at: new Date().toISOString(),
          published_by: profile?.id ?? null,
        })
        .gte('shift_date', from)
        .lte('shift_date', to)
        .in('status', ['draft', 'tentative'])
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rota-shifts'] }),
  })
}

/**
 * Staff acknowledges a confirmed shift.
 */
export function useAcknowledgeShift() {
  const qc = useQueryClient()
  const { profile } = useAuth()
  return useMutation({
    mutationFn: async ({
      shiftId,
      shiftStatus,
    }: {
      shiftId: string
      shiftStatus: RotaShiftRow['status']
    }) => {
      const { error } = await sb.from('rota_shift_acknowledgements').insert({
        rota_shift_id: shiftId,
        staff_id: profile!.id,
        acknowledged_at: new Date().toISOString(),
        shift_status_at_ack: shiftStatus,
      })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rota-shifts', 'mine'] }),
  })
}

// ── Staff Unavailability ───────────────────────────────────────────────────────

/**
 * Fetch staff unavailability records that overlap with a given week.
 * Manager view — returns all staff.
 */
export function useWeekUnavailability(weekStart: Date) {
  const { from, to } = weekRange(weekStart)
  return useQuery({
    queryKey: ['unavailability', 'week', from],
    queryFn: async (): Promise<(StaffUnavailabilityRow & { users: { id: string; first_name: string; last_name: string } | null })[]> => {
      const { data, error } = await sb
        .from('staff_unavailability')
        .select('*, users(id, first_name, last_name)')
        .lte('start_date', to)
        .gte('end_date', from)
      if (error) throw error
      return data ?? []
    },
  })
}
