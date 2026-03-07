import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/stores/authStore'
import type { Enums, Tables } from '@/types/database'

type TeamAttendanceRow = {
  team_id: string | null
  team_name: string | null
  user_id: string
  user_name: string
  work_date: string | null
  plan_status: string | null
  linked_booking_id: string | null
}

export function useMyAttendance(weekDates: Date[]) {
  const { profile } = useAuth()
  const from = weekDates[0]?.toISOString().slice(0, 10)
  const to = weekDates[weekDates.length - 1]?.toISOString().slice(0, 10)

  return useQuery({
    queryKey: ['attendance', 'mine', from, to],
    enabled: !!profile && !!from,
    queryFn: async (): Promise<Tables<'attendance_plans'>[]> => {
      const { data, error } = await supabase
        .from('attendance_plans')
        .select('*')
        .eq('user_id', profile!.id)
        .gte('work_date', from as string)
        .lte('work_date', to as string)
      if (error) throw error
      return (data ?? []) as unknown as Tables<'attendance_plans'>[]
    },
  })
}

export function useTeamAttendance(teamId: string | null, from: string, to: string) {
  return useQuery({
    queryKey: ['attendance', 'team', teamId, from, to],
    enabled: !!teamId,
    queryFn: async (): Promise<TeamAttendanceRow[]> => {
      const { data, error } = await supabase
        .from('v_team_attendance')
        .select('*')
        .eq('team_id', teamId!)
        .gte('work_date', from)
        .lte('work_date', to)
      if (error) throw error
      return (data ?? []) as unknown as TeamAttendanceRow[]
    },
  })
}

export function useUpsertAttendance() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (params: {
      workDate: string
      status: Enums<'plan_status'>
      linkedBookingId?: string
      notes?: string
    }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.rpc as any)('fn_upsert_attendance', {
        p_work_date: params.workDate,
        p_status: params.status,
        p_linked_booking_id: params.linkedBookingId ?? null,
        p_notes: params.notes ?? null,
      })
      if (error) throw error
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['attendance'] })
    },
  })
}
