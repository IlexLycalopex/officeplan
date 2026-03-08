import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any

// ── Types ──────────────────────────────────────────────────────────────────────

export type TeamRow = {
  id: string
  organisation_id: string
  department_id: string | null
  name: string
  manager_user_id: string | null
  active_flag: boolean
}

export type DepartmentRow = {
  id: string
  organisation_id: string
  name: string
  code: string | null
  active_flag: boolean
}

export type OrgRow = {
  id: string
  name: string
  slug: string
  logo_url: string | null
}

// ── Hooks ──────────────────────────────────────────────────────────────────────

export function useOrgInfo() {
  return useQuery({
    queryKey: ['org', 'info'],
    queryFn: async (): Promise<OrgRow | null> => {
      const { data, error } = await sb
        .from('organisations')
        .select('id, name, slug, logo_url')
        .single()
      if (error && error.code !== 'PGRST116') throw error
      return data ?? null
    },
  })
}

export function useUpdateOrgInfo() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, name, logo_url }: { id: string; name: string; logo_url: string | null }) => {
      const { error } = await sb
        .from('organisations')
        .update({ name, logo_url })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['org', 'info'] }),
  })
}

export function useTeams() {
  return useQuery({
    queryKey: ['org', 'teams'],
    queryFn: async (): Promise<TeamRow[]> => {
      const { data, error } = await sb
        .from('teams')
        .select('*')
        .eq('active_flag', true)
        .order('name')
      if (error) throw error
      return (data ?? []) as TeamRow[]
    },
  })
}

export function useDepartments() {
  return useQuery({
    queryKey: ['org', 'departments'],
    queryFn: async (): Promise<DepartmentRow[]> => {
      const { data, error } = await sb
        .from('departments')
        .select('*')
        .eq('active_flag', true)
        .order('name')
      if (error) throw error
      return (data ?? []) as DepartmentRow[]
    },
  })
}

export function useCreateTeam() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (team: { name: string; department_id: string | null; manager_user_id: string | null }) => {
      const { error } = await sb.from('teams').insert(team)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['org', 'teams'] }),
  })
}

export function useUpdateTeam() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...rest }: { id: string; name: string; department_id: string | null; manager_user_id: string | null }) => {
      const { error } = await sb.from('teams').update(rest).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['org', 'teams'] }),
  })
}

export function useDeleteTeam() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb.from('teams').update({ active_flag: false }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['org', 'teams'] }),
  })
}

export function useCreateDepartment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (dept: { name: string; code: string | null }) => {
      const { error } = await sb.from('departments').insert(dept)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['org', 'departments'] }),
  })
}

export function useDeleteDepartment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb.from('departments').update({ active_flag: false }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['org', 'departments'] }),
  })
}
