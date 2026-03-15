import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Tables } from '@/types/database'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any

export type BreakRuleRow = Tables<'break_rules'>

/** Fetch all break rules for the org (RLS-filtered) */
export function useBreakRules() {
  return useQuery({
    queryKey: ['break_rules'],
    queryFn: async (): Promise<BreakRuleRow[]> => {
      const { data, error } = await sb
        .from('break_rules')
        .select('*')
        .order('is_default', { ascending: false })
        .order('name')
      if (error) throw error
      return (data ?? []) as BreakRuleRow[]
    },
  })
}

/** Fetch the default break rule for the org */
export function useDefaultBreakRule() {
  return useQuery({
    queryKey: ['break_rules', 'default'],
    queryFn: async (): Promise<BreakRuleRow | null> => {
      const { data, error } = await sb
        .from('break_rules')
        .select('*')
        .eq('is_default', true)
        .maybeSingle()
      if (error) throw error
      return (data ?? null) as BreakRuleRow | null
    },
  })
}

/** Create a new break rule */
export function useCreateBreakRule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (rule: {
      name: string
      trigger_hours: number
      break_duration_minutes: number
      is_default?: boolean
    }) => {
      const { error } = await sb.from('break_rules').insert(rule)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['break_rules'] }),
  })
}

/** Update an existing break rule */
export function useUpdateBreakRule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      ...rest
    }: {
      id: string
      name?: string
      trigger_hours?: number
      break_duration_minutes?: number
      is_default?: boolean
    }) => {
      const { error } = await sb.from('break_rules').update(rest).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['break_rules'] }),
  })
}

/** Delete a break rule */
export function useDeleteBreakRule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb.from('break_rules').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['break_rules'] }),
  })
}
