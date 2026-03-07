import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/stores/authStore'
import type { Tables } from '@/types/database'

type BookingWithAsset = Tables<'bookings'> & {
  workspace_assets: unknown
}

type FloorBooking = {
  asset_id: string
  user_id: string
  status: string
  users: unknown
}

export function useMyBookings(from?: string, to?: string) {
  const { profile } = useAuth()
  return useQuery({
    queryKey: ['bookings', 'mine', from, to],
    enabled: !!profile,
    queryFn: async (): Promise<BookingWithAsset[]> => {
      let q = supabase
        .from('bookings')
        .select(`
          *,
          workspace_assets (
            id, code, name, asset_type, floor_id,
            floors ( name, office_id, offices ( name ) )
          )
        `)
        .eq('user_id', profile!.id)
        .in('status', ['confirmed', 'pending_approval'])
        .order('booking_date')

      if (from) q = q.gte('booking_date', from)
      if (to) q = q.lte('booking_date', to)

      const { data, error } = await q
      if (error) throw error
      return (data ?? []) as unknown as BookingWithAsset[]
    },
  })
}

export function useFloorBookings(floorId: string | null, date: string) {
  return useQuery({
    queryKey: ['bookings', 'floor', floorId, date],
    enabled: !!floorId,
    queryFn: async (): Promise<FloorBooking[]> => {
      const { data, error } = await supabase
        .from('bookings')
        .select('asset_id, user_id, status, users(first_name, last_name)')
        .eq('booking_date', date)
        .in('status', ['confirmed', 'pending_approval'])
      if (error) throw error
      return (data ?? []) as unknown as FloorBooking[]
    },
    staleTime: 30_000,
  })
}

export function useCreateBooking() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (params: {
      assetId: string
      userId: string
      date: string
      startTime?: string
      endTime?: string
      notes?: string
    }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.rpc as any)('fn_create_booking', {
        p_asset_id: params.assetId,
        p_user_id: params.userId,
        p_booking_date: params.date,
        p_start_time: params.startTime ?? null,
        p_end_time: params.endTime ?? null,
        p_notes: params.notes ?? null,
      })
      if (error) throw error
      if ((data as { error?: string }).error) throw new Error((data as { error: string }).error)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bookings'] })
    },
  })
}

export function useCancelBooking() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ bookingId, reason }: { bookingId: string; reason?: string }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.rpc as any)('fn_cancel_booking', {
        p_booking_id: bookingId,
        p_reason: reason ?? null,
      })
      if (error) throw error
      if ((data as { error?: string }).error) throw new Error((data as { error: string }).error)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bookings'] })
    },
  })
}
