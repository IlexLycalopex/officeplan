import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/stores/authStore'
import type { Enums } from '@/types/database'

export function useMyAttendance(weekDates: Date[]) {
  const { profile } = useAuth()
  const from = weekDates[0]?.toISOString().slice(0, 10)
  const to = weekDates[weekDates.length - 1]?.toISOString().slice(0, 10)

  return useQuery({
    queryKey: ['attendance', 'mine', from, to],
    enabled: !!profile && !!from,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('attendance_plans')
        .select('*')
        .eq('user_id', profile!.id)
        .gte('work_date', from)
        .lte('work_date', to)
      if (error) throw error
      return data
    },
  })
}

export function useTeamAttendance(teamId: string | null, from: string, to: string) {
  return useQuery({
    queryKey: ['attendance', 'team', teamId, from, to],
    enabled: !!teamId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_team_attendance')
        .select('*')
        .eq('team_id', teamId!)
        .gte('work_date', from)
        .lte('work_date', to)
      if (error) throw error
      return data
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
      const { data, error } = await supabase.rpc('fn_upsert_attendance', {
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
