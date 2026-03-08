import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Plus, Pencil, Trash2, Check, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import {
  useOrgInfo, useUpdateOrgInfo,
  useTeams, useCreateTeam, useUpdateTeam, useDeleteTeam,
  useDepartments, useCreateDepartment, useDeleteDepartment,
} from '@/hooks/useOrganisation'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any

function useOrgUsers() {
  return useQuery({
    queryKey: ['admin', 'users', 'simple'],
    queryFn: async () => {
      const { data, error } = await sb
        .from('users')
        .select('id, first_name, last_name')
        .eq('status', 'active')
        .order('last_name')
      if (error) throw error
      return (data ?? []) as { id: string; first_name: string; last_name: string }[]
    },
  })
}

export default function AdminOrganisation() {
  const { data: org } = useOrgInfo()
  const updateOrg = useUpdateOrgInfo()
  const { data: teams } = useTeams()
  const { data: departments } = useDepartments()
  const { data: users } = useOrgUsers()

  const createTeam = useCreateTeam()
  const updateTeam = useUpdateTeam()
  const deleteTeam = useDeleteTeam()
  const createDept = useCreateDepartment()
  const deleteDept = useDeleteDepartment()

  // Org info form
  const [orgName, setOrgName] = useState('')
  const [orgLogo, setOrgLogo] = useState('')
  const [orgSaved, setOrgSaved] = useState(false)

  useEffect(() => {
    if (org) {
      setOrgName(org.name)
      setOrgLogo(org.logo_url ?? '')
    }
  }, [org])

  function saveOrg() {
    if (!org) return
    updateOrg.mutate(
      { id: org.id, name: orgName, logo_url: orgLogo || null },
      { onSuccess: () => { setOrgSaved(true); setTimeout(() => setOrgSaved(false), 3000) } },
    )
  }

  // Department form
  const [newDeptName, setNewDeptName] = useState('')
  const [newDeptCode, setNewDeptCode] = useState('')
  const [showDeptForm, setShowDeptForm] = useState(false)
  const [confirmDeleteDept, setConfirmDeleteDept] = useState<{ id: string; name: string } | null>(null)

  // Team form
  const [showTeamForm, setShowTeamForm] = useState(false)
  const [newTeamName, setNewTeamName] = useState('')
  const [newTeamDeptId, setNewTeamDeptId] = useState('')
  const [newTeamManagerId, setNewTeamManagerId] = useState('')

  // Edit team inline
  const [editTeamId, setEditTeamId] = useState<string | null>(null)
  const [editTeamForm, setEditTeamForm] = useState({ name: '', department_id: '', manager_user_id: '' })

  // Delete confirm
  const [confirmDeleteTeam, setConfirmDeleteTeam] = useState<{ id: string; name: string } | null>(null)

  function startEditTeam(t: { id: string; name: string; department_id: string | null; manager_user_id: string | null }) {
    setEditTeamId(t.id)
    setEditTeamForm({
      name: t.name,
      department_id: t.department_id ?? '',
      manager_user_id: t.manager_user_id ?? '',
    })
  }

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-xl font-semibold text-gray-900">Organisation</h1>

      {/* ── Org Info ──────────────────────────────────────────────────── */}
      <section className="rounded-xl border border-gray-200 bg-white p-6 space-y-4">
        <h2 className="text-sm font-semibold text-gray-700">Organisation Info</h2>

        <label className="block">
          <span className="text-xs font-medium text-gray-600">Name</span>
          <input
            value={orgName}
            onChange={e => setOrgName(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />
        </label>

        <label className="block">
          <span className="text-xs font-medium text-gray-600">Slug (read-only)</span>
          <input
            value={org?.slug ?? ''}
            readOnly
            className="mt-1 block w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-400"
          />
        </label>

        <label className="block">
          <span className="text-xs font-medium text-gray-600">Logo URL</span>
          <input
            value={orgLogo}
            onChange={e => setOrgLogo(e.target.value)}
            placeholder="https://…"
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />
        </label>

        <div className="flex items-center gap-3">
          <button
            onClick={saveOrg}
            disabled={updateOrg.isPending || !orgName}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {updateOrg.isPending ? 'Saving…' : 'Save'}
          </button>
          {orgSaved && <span className="text-sm text-green-600">Saved!</span>}
        </div>
      </section>

      {/* ── Departments ───────────────────────────────────────────────── */}
      <section className="rounded-xl border border-gray-200 bg-white p-6 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700">Departments</h2>
          <button
            onClick={() => setShowDeptForm(v => !v)}
            className="flex items-center gap-1 rounded-lg bg-gray-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-900"
          >
            <Plus size={12} /> Add
          </button>
        </div>

        {showDeptForm && (
          <div className="flex gap-2">
            <input
              placeholder="Department name *"
              value={newDeptName}
              onChange={e => setNewDeptName(e.target.value)}
              className="flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
            />
            <input
              placeholder="Code"
              value={newDeptCode}
              onChange={e => setNewDeptCode(e.target.value)}
              className="w-24 rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
            />
            <button
              onClick={() => {
                if (newDeptName) {
                  createDept.mutate(
                    { name: newDeptName, code: newDeptCode || null },
                    { onSuccess: () => { setNewDeptName(''); setNewDeptCode(''); setShowDeptForm(false) } },
                  )
                }
              }}
              disabled={!newDeptName || createDept.isPending}
              className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
            >
              <Check size={14} />
            </button>
            <button onClick={() => setShowDeptForm(false)}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-500 hover:bg-gray-50">
              <X size={14} />
            </button>
          </div>
        )}

        <div className="space-y-1">
          {(departments ?? []).length === 0 && (
            <p className="text-xs text-gray-400">No departments yet.</p>
          )}
          {(departments ?? []).map(d => (
            <div key={d.id} className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 text-sm">
              <div>
                <span className="font-medium text-gray-800">{d.name}</span>
                {d.code && <span className="ml-2 text-xs text-gray-400">{d.code}</span>}
              </div>
              <button
                onClick={() => setConfirmDeleteDept({ id: d.id, name: d.name })}
                className="rounded p-0.5 text-gray-400 hover:text-red-600"
                title="Delete department"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* ── Teams ─────────────────────────────────────────────────────── */}
      <section className="rounded-xl border border-gray-200 bg-white p-6 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700">Teams</h2>
          <button
            onClick={() => setShowTeamForm(v => !v)}
            className="flex items-center gap-1 rounded-lg bg-gray-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-900"
          >
            <Plus size={12} /> Add team
          </button>
        </div>

        {showTeamForm && (
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 space-y-2">
            <input
              placeholder="Team name *"
              value={newTeamName}
              onChange={e => setNewTeamName(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
            />
            <div className="grid grid-cols-2 gap-2">
              <select
                value={newTeamDeptId}
                onChange={e => setNewTeamDeptId(e.target.value)}
                className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
              >
                <option value="">No department</option>
                {(departments ?? []).map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
              <select
                value={newTeamManagerId}
                onChange={e => setNewTeamManagerId(e.target.value)}
                className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
              >
                <option value="">No manager</option>
                {(users ?? []).map(u => (
                  <option key={u.id} value={u.id}>{u.first_name} {u.last_name}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  if (newTeamName) {
                    createTeam.mutate(
                      { name: newTeamName, department_id: newTeamDeptId || null, manager_user_id: newTeamManagerId || null },
                      { onSuccess: () => { setNewTeamName(''); setNewTeamDeptId(''); setNewTeamManagerId(''); setShowTeamForm(false) } },
                    )
                  }
                }}
                disabled={!newTeamName || createTeam.isPending}
                className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                Create team
              </button>
              <button onClick={() => setShowTeamForm(false)}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-white">
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="space-y-1">
          {(teams ?? []).length === 0 && (
            <p className="text-xs text-gray-400">No teams yet.</p>
          )}
          {(teams ?? []).map(t => {
            const deptName = (departments ?? []).find(d => d.id === t.department_id)?.name
            const managerUser = (users ?? []).find(u => u.id === t.manager_user_id)
            const isEditing = editTeamId === t.id
            return (
              <div key={t.id} className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
                {isEditing ? (
                  <div className="space-y-2">
                    <input
                      value={editTeamForm.name}
                      onChange={e => setEditTeamForm(f => ({ ...f, name: e.target.value }))}
                      className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <select
                        value={editTeamForm.department_id}
                        onChange={e => setEditTeamForm(f => ({ ...f, department_id: e.target.value }))}
                        className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
                      >
                        <option value="">No department</option>
                        {(departments ?? []).map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                      </select>
                      <select
                        value={editTeamForm.manager_user_id}
                        onChange={e => setEditTeamForm(f => ({ ...f, manager_user_id: e.target.value }))}
                        className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
                      >
                        <option value="">No manager</option>
                        {(users ?? []).map(u => (
                          <option key={u.id} value={u.id}>{u.first_name} {u.last_name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => updateTeam.mutate(
                          { id: t.id, name: editTeamForm.name, department_id: editTeamForm.department_id || null, manager_user_id: editTeamForm.manager_user_id || null },
                          { onSuccess: () => setEditTeamId(null) },
                        )}
                        disabled={!editTeamForm.name || updateTeam.isPending}
                        className="rounded-lg bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                      >
                        Save
                      </button>
                      <button onClick={() => setEditTeamId(null)}
                        className="rounded-lg border border-gray-300 px-3 py-1 text-xs text-gray-500 hover:bg-white">
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-800">{t.name}</p>
                      <p className="text-xs text-gray-400">
                        {[deptName, managerUser ? `Manager: ${managerUser.first_name} ${managerUser.last_name}` : null].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => startEditTeam(t)}
                        className="rounded p-1 text-gray-400 hover:text-blue-600"
                        title="Edit team"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => setConfirmDeleteTeam({ id: t.id, name: t.name })}
                        className="rounded p-1 text-gray-400 hover:text-red-600"
                        title="Delete team"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </section>

      {/* Delete confirmations */}
      {(confirmDeleteDept || confirmDeleteTeam) && (() => {
        const item = confirmDeleteDept ?? confirmDeleteTeam!
        const isDept = !!confirmDeleteDept
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="w-80 rounded-xl bg-white p-6 shadow-xl">
              <h3 className="font-semibold text-gray-900">
                Delete {isDept ? 'department' : 'team'}?
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                <strong>{item.name}</strong> will be deactivated. Users assigned to it will keep the association but the {isDept ? 'department' : 'team'} won't appear in dropdowns.
              </p>
              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => {
                    if (isDept) deleteDept.mutate(item.id, { onSuccess: () => setConfirmDeleteDept(null) })
                    else deleteTeam.mutate(item.id, { onSuccess: () => setConfirmDeleteTeam(null) })
                  }}
                  disabled={deleteDept.isPending || deleteTeam.isPending}
                  className="flex-1 rounded-lg bg-red-600 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                >
                  Delete
                </button>
                <button
                  onClick={() => { setConfirmDeleteDept(null); setConfirmDeleteTeam(null) }}
                  className="flex-1 rounded-lg border border-gray-300 py-2 text-sm text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
