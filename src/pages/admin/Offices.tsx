import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, ChevronDown, ChevronRight, Pencil, Trash2, Check, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { Tables } from '@/types/database'

type FloorRow = { id: string; name: string; sequence: number; active_flag: boolean }
type OfficeWithFloors = Tables<'offices'> & { floors: FloorRow[] }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any

function useOfficesWithFloors() {
  return useQuery({
    queryKey: ['admin', 'offices'],
    queryFn: async (): Promise<OfficeWithFloors[]> => {
      const { data, error } = await sb
        .from('offices')
        .select('*, floors(id, name, sequence, active_flag)')
        .eq('active_flag', true)
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

  // Edit office state
  const [editingOfficeId, setEditingOfficeId] = useState<string | null>(null)
  const [editOfficeForm, setEditOfficeForm] = useState({ name: '', address: '', city: '' })

  // Edit floor state
  const [editingFloorId, setEditingFloorId] = useState<string | null>(null)
  const [editFloorName, setEditFloorName] = useState('')

  // Delete confirm
  const [confirmDelete, setConfirmDelete] = useState<{ type: 'office' | 'floor'; id: string; name: string } | null>(null)

  const addOffice = useMutation({
    mutationFn: async () => {
      const orgId = (await sb.from('organisations').select('id').single()).data?.id
      const { error } = await sb.from('offices').insert({
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

  const updateOffice = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { name: string; address: string; city: string } }) => {
      const { error } = await sb.from('offices').update(data).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'offices'] })
      setEditingOfficeId(null)
    },
  })

  const deleteOffice = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb.from('offices').update({ active_flag: false }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'offices'] })
      qc.invalidateQueries({ queryKey: ['offices'] })
      setConfirmDelete(null)
    },
  })

  const addFloor = useMutation({
    mutationFn: async ({ officeId, name }: { officeId: string; name: string }) => {
      const floors = offices?.find(o => o.id === officeId)?.floors ?? []
      const { error } = await sb.from('floors').insert({
        office_id: officeId,
        name,
        sequence: (floors.length ?? 0) + 1,
      })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'offices'] }),
  })

  const updateFloor = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const { error } = await sb.from('floors').update({ name }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'offices'] })
      setEditingFloorId(null)
    },
  })

  const deleteFloor = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb.from('floors').update({ active_flag: false }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'offices'] })
      setConfirmDelete(null)
    },
  })

  function toggle(id: string) {
    setExpanded(e => e.includes(id) ? e.filter(x => x !== id) : [...e, id])
  }

  function startEditOffice(o: OfficeWithFloors) {
    setEditingOfficeId(o.id)
    setEditOfficeForm({ name: o.name, address: o.address ?? '', city: o.city ?? '' })
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
            <input placeholder="Name *" value={newOffice.name}
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
          const isEditingThis = editingOfficeId === office.id
          const floors = office.floors.filter(f => f.active_flag !== false)
          return (
            <div key={office.id} className="rounded-xl border border-gray-200 bg-white overflow-hidden">
              {/* Office header */}
              {isEditingThis ? (
                <div className="px-4 py-3 space-y-2">
                  <p className="text-xs font-semibold text-gray-600 mb-1">Edit office</p>
                  <div className="grid gap-2 sm:grid-cols-3">
                    <input
                      value={editOfficeForm.name}
                      onChange={e => setEditOfficeForm(f => ({ ...f, name: e.target.value }))}
                      placeholder="Name *"
                      className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
                    />
                    <input
                      value={editOfficeForm.city}
                      onChange={e => setEditOfficeForm(f => ({ ...f, city: e.target.value }))}
                      placeholder="City"
                      className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
                    />
                    <input
                      value={editOfficeForm.address}
                      onChange={e => setEditOfficeForm(f => ({ ...f, address: e.target.value }))}
                      placeholder="Address"
                      className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => updateOffice.mutate({ id: office.id, data: editOfficeForm })}
                      disabled={!editOfficeForm.name || updateOffice.isPending}
                      className="flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                    >
                      <Check size={12} /> Save
                    </button>
                    <button onClick={() => setEditingOfficeId(null)}
                      className="flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50">
                      <X size={12} /> Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex w-full items-center justify-between px-4 py-3">
                  <button onClick={() => toggle(office.id)} className="flex flex-1 items-center text-left">
                    <div>
                      <p className="font-medium text-gray-900">{office.name}</p>
                      <p className="text-xs text-gray-500">{[office.city, office.address].filter(Boolean).join(' · ')} · {floors.length} floor{floors.length !== 1 ? 's' : ''}</p>
                    </div>
                  </button>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => startEditOffice(office)}
                      className="rounded p-1 text-gray-400 hover:text-blue-600"
                      title="Edit office"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => setConfirmDelete({ type: 'office', id: office.id, name: office.name })}
                      className="rounded p-1 text-gray-400 hover:text-red-600"
                      title="Delete office"
                    >
                      <Trash2 size={14} />
                    </button>
                    <button onClick={() => toggle(office.id)} className="rounded p-1 text-gray-400 hover:text-gray-600">
                      {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    </button>
                  </div>
                </div>
              )}

              {isExpanded && !isEditingThis && (
                <div className="border-t border-gray-100 px-4 py-3">
                  <div className="space-y-1">
                    {floors.sort((a, b) => a.sequence - b.sequence).map(f => (
                      <div key={f.id} className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 text-sm">
                        {editingFloorId === f.id ? (
                          <div className="flex flex-1 items-center gap-2">
                            <input
                              value={editFloorName}
                              onChange={e => setEditFloorName(e.target.value)}
                              className="flex-1 rounded border border-gray-300 px-2 py-1 text-sm"
                              autoFocus
                            />
                            <button
                              onClick={() => updateFloor.mutate({ id: f.id, name: editFloorName })}
                              disabled={!editFloorName || updateFloor.isPending}
                              className="rounded bg-blue-600 px-2 py-1 text-xs text-white hover:bg-blue-700"
                            >
                              <Check size={12} />
                            </button>
                            <button onClick={() => setEditingFloorId(null)}
                              className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-500 hover:bg-white">
                              <X size={12} />
                            </button>
                          </div>
                        ) : (
                          <>
                            <span className="text-gray-700">{f.name}</span>
                            <div className="flex items-center gap-2">
                              <Link
                                to={`/admin/floor-editor?floorId=${f.id}`}
                                className="text-xs text-blue-600 hover:underline"
                              >
                                Edit layout →
                              </Link>
                              <button
                                onClick={() => { setEditingFloorId(f.id); setEditFloorName(f.name) }}
                                className="rounded p-0.5 text-gray-400 hover:text-blue-600"
                                title="Rename floor"
                              >
                                <Pencil size={12} />
                              </button>
                              <button
                                onClick={() => setConfirmDelete({ type: 'floor', id: f.id, name: f.name })}
                                className="rounded p-0.5 text-gray-400 hover:text-red-600"
                                title="Delete floor"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </>
                        )}
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

      {/* Delete confirmation dialog */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-80 rounded-xl bg-white p-6 shadow-xl">
            <h3 className="font-semibold text-gray-900">
              Delete {confirmDelete.type === 'office' ? 'office' : 'floor'}?
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              <strong>{confirmDelete.name}</strong> will be deactivated. Existing bookings will be unaffected but no new bookings can be made.
            </p>
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => {
                  if (confirmDelete.type === 'office') deleteOffice.mutate(confirmDelete.id)
                  else deleteFloor.mutate(confirmDelete.id)
                }}
                disabled={deleteOffice.isPending || deleteFloor.isPending}
                className="flex-1 rounded-lg bg-red-600 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {deleteOffice.isPending || deleteFloor.isPending ? 'Deleting…' : 'Delete'}
              </button>
              <button
                onClick={() => setConfirmDelete(null)}
                className="flex-1 rounded-lg border border-gray-300 py-2 text-sm text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
