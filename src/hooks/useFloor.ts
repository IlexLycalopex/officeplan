import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Tables } from '@/types/database'

type OfficeWithFloors = Tables<'offices'> & {
  floors: Pick<Tables<'floors'>, 'id' | 'name' | 'sequence'>[]
}

type FloorWithOffice = Tables<'floors'> & {
  offices: Pick<Tables<'offices'>, 'id' | 'name' | 'city'> | null
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any

export function useOffices() {
  return useQuery({
    queryKey: ['offices'],
    queryFn: async (): Promise<OfficeWithFloors[]> => {
      const { data, error } = await sb
        .from('offices')
        .select('*, floors(id, name, sequence)')
        .eq('active_flag', true)
        .order('name')
      if (error) throw error
      return (data ?? []) as OfficeWithFloors[]
    },
  })
}

export function useFloorAssets(floorId: string | null) {
  return useQuery({
    queryKey: ['floor-assets', floorId],
    enabled: !!floorId,
    queryFn: async (): Promise<Tables<'workspace_assets'>[]> => {
      const { data, error } = await sb
        .from('workspace_assets')
        .select('*')
        .eq('floor_id', floorId!)
        .eq('is_draft', false)
        .order('code')
      if (error) throw error
      return (data ?? []) as Tables<'workspace_assets'>[]
    },
  })
}

export function useFloorAssetsAdmin(floorId: string | null) {
  return useQuery({
    queryKey: ['floor-assets-admin', floorId],
    enabled: !!floorId,
    queryFn: async (): Promise<Tables<'workspace_assets'>[]> => {
      const { data, error } = await sb
        .from('workspace_assets')
        .select('*')
        .eq('floor_id', floorId!)
        .order('code')
      if (error) throw error
      return (data ?? []) as Tables<'workspace_assets'>[]
    },
  })
}

export function useFloor(floorId: string | null) {
  return useQuery({
    queryKey: ['floor', floorId],
    enabled: !!floorId,
    queryFn: async (): Promise<FloorWithOffice | null> => {
      const { data, error } = await sb
        .from('floors')
        .select('*, offices(id, name, city)')
        .eq('id', floorId!)
        .single()
      if (error) throw error
      return data as FloorWithOffice
    },
  })
}
