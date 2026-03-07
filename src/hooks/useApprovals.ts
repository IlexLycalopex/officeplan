import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Tables } from '@/types/database'

type PendingApproval = Tables<'approval_requests'> & {
  requester: unknown
  bookings: unknown
}

type MyApproval = Tables<'approval_requests'> & {
  bookings: unknown
}

export function usePendingApprovals() {
  return useQuery({
    queryKey: ['approvals', 'pending'],
    queryFn: async (): Promise<PendingApproval[]> => {
      const { data, error } = await supabase
        .from('approval_requests')
        .select(`
          *,
          requester: users!requester_user_id (first_name, last_name, email, job_title),
          bookings: bookings (
            booking_date, notes,
            workspace_assets (code, name, asset_type,
              floors (name, offices (name))
            )
          )
        `)
        .eq('status', 'pending')
        .order('created_at')
      if (error) throw error
      return (data ?? []) as unknown as PendingApproval[]
    },
  })
}

export function useMyApprovals() {
  return useQuery({
    queryKey: ['approvals', 'mine'],
    queryFn: async (): Promise<MyApproval[]> => {
      const { data, error } = await supabase
        .from('approval_requests')
        .select(`
          *,
          bookings (booking_date, workspace_assets (code, name, floors (name, offices (name))))
        `)
        .order('created_at', { ascending: false })
        .limit(20)
      if (error) throw error
      return (data ?? []) as unknown as MyApproval[]
    },
  })
}

export function useDecideApproval() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      requestId,
      decision,
      notes,
    }: {
      requestId: string
      decision: 'approved' | 'rejected'
      notes?: string
    }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.rpc as any)('fn_decide_approval', {
        p_request_id: requestId,
        p_decision: decision,
        p_notes: notes ?? null,
      })
      if (error) throw error
      if ((data as { error?: string }).error) throw new Error((data as { error: string }).error)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['approvals'] })
      qc.invalidateQueries({ queryKey: ['bookings'] })
    },
  })
}
