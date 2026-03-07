import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, ChevronDown, ChevronRight } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { Tables } from '@/types/database'

type OfficeWithFloors = Tables<'offices'> & { floors: unknown }

function useOfficesWithFloors() {
  return useQuery({
    queryKey: ['admin', 'offices'],
    queryFn: async (): Promise<OfficeWithFloors[]> => {
      const { data, error } = await supabase
        .from('offices')
        .select('*, floors(id, name, sequence, active_flag)')
        .order('name')
      if (error) throw error
      return (data ?? []) as unknown as OfficeWithFloors[]
    },
  })
}

export default function AdminOffices() {
  const { data: offices, isLoading } = useOfficesWithFloors()
  const qc = useQueryClient()
  const [expanded, setExpanded] = useState<string[]>([])
  const [newOffice, setNewOffice] = useState({ name: '', address: '', city: '' })
  const [showNewOffice, setShowNewOffice] = useState(false)
  const [newFloor, setNewFloor] = useState<Record<string, string>>({})

  const addOffice = useMutation({
    mutationFn: async () => {
      const orgId = (await supabase.from('organisations').select('id').single()).data?.id
      const { error } = await supabase.from('offices').insert({
        organisation_id: orgId!,
        ...newOffice,
      })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'offices'] })
      setNewOffice({ name: '', address: '', city: '' })
      setShowNewOffice(false)
    },
  })

  const addFloor = useMutation({
    mutationFn: async ({ officeId, name }: { officeId: string; name: string }) => {
      const floors = offices?.find(o => o.id === officeId)?.floors as { sequence?: number }[] | null ?? []
      const { error } = await supabase.from('floors').insert({
        office_id: officeId,
        name,
        sequence: (floors.length ?? 0) + 1,
      })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'offices'] }),
  })

  function toggle(id: string) {
    setExpanded(e => e.includes(id) ? e.filter(x => x !== id) : [...e, id])
  }

  return (
    <div className="max-w-3xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Offices & Floors</h1>
        <button
          onClick={() => setShowNewOffice(true)}
          className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Plus size={14} /> Add office
        </button>
      </div>

      {showNewOffice && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
          <h3 className="mb-3 text-sm font-semibold text-gray-800">New Office</h3>
          <div className="grid gap-3 sm:grid-cols-3">
            <input placeholder="Name" value={newOffice.name}
              onChange={e => setNewOffice(o => ({ ...o, name: e.target.value }))}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            <input placeholder="City" value={newOffice.city}
              onChange={e => setNewOffice(o => ({ ...o, city: e.target.value }))}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            <input placeholder="Address" value={newOffice.address}
              onChange={e => setNewOffice(o => ({ ...o, address: e.target.value }))}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          </div>
          <div className="mt-3 flex gap-2">
            <button
              onClick={() => addOffice.mutate()}
              disabled={!newOffice.name || addOffice.isPending}
              className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {addOffice.isPending ? 'Adding…' : 'Add office'}
            </button>
            <button onClick={() => setShowNewOffice(false)}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-white">
              Cancel
            </button>
          </div>
        </div>
      )}

      {isLoading && <p className="text-sm text-gray-500">Loading…</p>}

      <div className="space-y-2">
        {offices?.map(office => {
          const isExpanded = expanded.includes(office.id)
          const floors = (office.floors as { id: string; name: string; sequence: number }[]) ?? []
          return (
            <div key={office.id} className="rounded-xl border border-gray-200 bg-white overflow-hidden">
              <button
                onClick={() => toggle(office.id)}
                className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-gray-50"
              >
                <div>
                  <p className="font-medium text-gray-900">{office.name}</p>
                  <p className="text-xs text-gray-500">{office.city} · {floors.length} floor{floors.length !== 1 ? 's' : ''}</p>
                </div>
                {isExpanded ? <ChevronDown size={16} className="text-gray-400" /> : <ChevronRight size={16} className="text-gray-400" />}
              </button>

              {isExpanded && (
                <div className="border-t border-gray-100 px-4 py-3">
                  <div className="space-y-1">
                    {floors.sort((a, b) => a.sequence - b.sequence).map(f => (
                      <div key={f.id} className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 text-sm">
                        <span className="text-gray-700">{f.name}</span>
                        <a
                          href={`/admin/floor-editor?floorId=${f.id}`}
                          className="text-xs text-blue-600 hover:underline"
                        >
                          Edit layout →
                        </a>
                      </div>
                    ))}
                  </div>

                  {/* Add floor */}
                  <div className="mt-3 flex gap-2">
                    <input
                      placeholder="New floor name (e.g. Floor 2)"
                      value={newFloor[office.id] ?? ''}
                      onChange={e => setNewFloor(nf => ({ ...nf, [office.id]: e.target.value }))}
                      className="flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
                    />
                    <button
                      onClick={() => {
                        if (newFloor[office.id]) {
                          addFloor.mutate({ officeId: office.id, name: newFloor[office.id] })
                          setNewFloor(nf => ({ ...nf, [office.id]: '' }))
                        }
                      }}
                      className="rounded-lg bg-gray-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-900"
                    >
                      + Floor
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
