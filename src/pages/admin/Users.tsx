import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Search, UserX, UserCheck, Plus, Send, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useTeams } from '@/hooks/useOrganisation'
import type { Tables } from '@/types/database'

type User = Tables<'users'>
type UserWithDepts = Tables<'users'> & { departments: unknown; teams: unknown; offices: unknown }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any

function useAllUsers() {
  return useQuery({
    queryKey: ['admin', 'users'],
    queryFn: async (): Promise<UserWithDepts[]> => {
      const { data, error } = await sb
        .from('users')
        .select(`*, departments(name), teams(name), offices:primary_office_id(name)`)
        .order('last_name')
      if (error) throw error
      return (data ?? []) as unknown as UserWithDepts[]
    },
  })
}

export default function AdminUsers() {
  const { data: users, isLoading } = useAllUsers()
  const { data: teams } = useTeams()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [showInvite, setShowInvite] = useState(false)
  const [invite, setInvite] = useState({ email: '', first_name: '', last_name: '', role: 'employee', team_id: '' })
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null)

  // Inline edit state
  const [editingUserId, setEditingUserId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ first_name: '', last_name: '', job_title: '' })

  const toggleStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: 'active' | 'inactive' }) => {
      const { error } = await sb.from('users').update({ status }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'users'] }),
  })

  const changeRole = useMutation({
    mutationFn: async ({ id, role }: { id: string; role: User['role'] }) => {
      const { error } = await sb.from('users').update({ role }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'users'] }),
  })

  const changeTeam = useMutation({
    mutationFn: async ({ id, team_id }: { id: string; team_id: string | null }) => {
      const { error } = await sb.from('users').update({ team_id }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'users'] }),
  })

  const saveUserEdit = useMutation({
    mutationFn: async ({ id, ...data }: { id: string; first_name: string; last_name: string; job_title: string }) => {
      const { error } = await sb.from('users').update(data).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'users'] })
      setEditingUserId(null)
    },
  })

  const inviteUser = useMutation({
    mutationFn: async () => {
      // 1. Get org id
      const { data: orgData } = await sb.from('organisations').select('id').single()
      const orgId = orgData?.id
      if (!orgId) throw new Error('No organisation found')

      // 2. Insert user row (auth_user_id stays NULL until first login)
      const { error: insertError } = await sb.from('users').insert({
        organisation_id: orgId,
        email: invite.email,
        first_name: invite.first_name,
        last_name: invite.last_name,
        role: invite.role,
        team_id: invite.team_id || null,
        status: 'active',
      })
      if (insertError) throw insertError

      // 3. Call invite-user edge function to send magic-link email
      const { error: fnError } = await sb.functions.invoke('invite-user', {
        body: { email: invite.email },
      })
      if (fnError) {
        // Non-fatal — user row created, email may not send. Surface as warning.
        console.warn('Invite email failed:', fnError)
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'users'] })
      setInviteSuccess(`Invite sent to ${invite.email}`)
      setInvite({ email: '', first_name: '', last_name: '', role: 'employee', team_id: '' })
      setShowInvite(false)
      setTimeout(() => setInviteSuccess(null), 5000)
    },
    onError: (e: unknown) => {
      setInviteError(e instanceof Error ? e.message : 'Invite failed')
    },
  })

  const resendInvite = useMutation({
    mutationFn: async (email: string) => {
      const { error } = await sb.functions.invoke('invite-user', { body: { email } })
      if (error) throw error
    },
  })

  const filtered = (users ?? []).filter(u =>
    `${u.first_name} ${u.last_name} ${u.email}`.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="max-w-6xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Users</h1>
        <div className="flex items-center gap-2">
          <p className="text-sm text-gray-500">{users?.length ?? 0} total</p>
          <button
            onClick={() => { setShowInvite(true); setInviteError(null) }}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            <Plus size={14} /> Invite user
          </button>
        </div>
      </div>

      {inviteSuccess && (
        <div className="rounded-lg bg-green-50 px-4 py-2 text-sm text-green-800">{inviteSuccess}</div>
      )}

      {/* Invite form */}
      {showInvite && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-800">Invite new user</h3>
            <button onClick={() => setShowInvite(false)}><X size={16} className="text-gray-400" /></button>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <input
              placeholder="First name *"
              value={invite.first_name}
              onChange={e => setInvite(i => ({ ...i, first_name: e.target.value }))}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
            <input
              placeholder="Last name *"
              value={invite.last_name}
              onChange={e => setInvite(i => ({ ...i, last_name: e.target.value }))}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
            <input
              placeholder="Email address *"
              type="email"
              value={invite.email}
              onChange={e => setInvite(i => ({ ...i, email: e.target.value }))}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm sm:col-span-2"
            />
            <select
              value={invite.role}
              onChange={e => setInvite(i => ({ ...i, role: e.target.value }))}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              {(['employee', 'manager', 'approver', 'admin'] as User['role'][]).map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
            <select
              value={invite.team_id}
              onChange={e => setInvite(i => ({ ...i, team_id: e.target.value }))}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">No team</option>
              {(teams ?? []).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          {inviteError && <p className="text-sm text-red-600">{inviteError}</p>}
          <div className="flex gap-2">
            <button
              onClick={() => inviteUser.mutate()}
              disabled={!invite.email || !invite.first_name || !invite.last_name || inviteUser.isPending}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {inviteUser.isPending ? 'Sending…' : 'Send invite'}
            </button>
            <button onClick={() => setShowInvite(false)}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-white">
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name or email…"
          className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm focus:border-blue-500 focus:outline-none"
        />
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {['Name', 'Email', 'Team', 'Role', 'Status', 'Actions'].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {isLoading ? (
              <tr><td colSpan={6} className="py-8 text-center text-sm text-gray-400">Loading…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={6} className="py-8 text-center text-sm text-gray-400">No users found.</td></tr>
            ) : filtered.map(u => (
              <tr key={u.id} className="hover:bg-gray-50">
                {/* Name — inline editable */}
                <td className="px-4 py-3 text-sm">
                  {editingUserId === u.id ? (
                    <div className="space-y-1">
                      <input
                        value={editForm.first_name}
                        onChange={e => setEditForm(f => ({ ...f, first_name: e.target.value }))}
                        className="w-full rounded border border-gray-300 px-2 py-1 text-xs"
                        placeholder="First name"
                      />
                      <input
                        value={editForm.last_name}
                        onChange={e => setEditForm(f => ({ ...f, last_name: e.target.value }))}
                        className="w-full rounded border border-gray-300 px-2 py-1 text-xs"
                        placeholder="Last name"
                      />
                      <input
                        value={editForm.job_title}
                        onChange={e => setEditForm(f => ({ ...f, job_title: e.target.value }))}
                        className="w-full rounded border border-gray-300 px-2 py-1 text-xs"
                        placeholder="Job title"
                      />
                      <div className="flex gap-1 pt-1">
                        <button
                          onClick={() => saveUserEdit.mutate({ id: u.id, ...editForm })}
                          className="rounded bg-blue-600 px-2 py-0.5 text-xs text-white"
                        >Save</button>
                        <button
                          onClick={() => setEditingUserId(null)}
                          className="rounded border border-gray-300 px-2 py-0.5 text-xs text-gray-500"
                        >Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        setEditingUserId(u.id)
                        setEditForm({ first_name: u.first_name, last_name: u.last_name, job_title: u.job_title ?? '' })
                      }}
                      className="text-left group"
                    >
                      <p className="font-medium text-gray-900 group-hover:text-blue-600">
                        {u.first_name} {u.last_name}
                      </p>
                      <p className="text-xs text-gray-400">{u.job_title}</p>
                      {!(u as unknown as { auth_user_id: string | null }).auth_user_id && (
                        <span className="text-[10px] text-amber-500 font-medium">Pending first login</span>
                      )}
                    </button>
                  )}
                </td>

                <td className="px-4 py-3 text-sm text-gray-600">{u.email}</td>

                {/* Team dropdown */}
                <td className="px-4 py-3">
                  <select
                    value={(u as unknown as { team_id: string | null }).team_id ?? ''}
                    onChange={e => changeTeam.mutate({ id: u.id, team_id: e.target.value || null })}
                    className="rounded border border-gray-300 px-2 py-1 text-xs max-w-[140px]"
                  >
                    <option value="">No team</option>
                    {(teams ?? []).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </td>

                {/* Role dropdown */}
                <td className="px-4 py-3">
                  <select
                    value={u.role}
                    onChange={e => changeRole.mutate({ id: u.id, role: e.target.value as User['role'] })}
                    className="rounded border border-gray-300 px-2 py-1 text-xs"
                  >
                    {(['employee', 'manager', 'approver', 'admin'] as User['role'][]).map(r => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </td>

                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    u.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {u.status}
                  </span>
                </td>

                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => toggleStatus.mutate({
                        id: u.id,
                        status: u.status === 'active' ? 'inactive' : 'active',
                      })}
                      className="rounded p-1 text-gray-400 hover:text-gray-700"
                      title={u.status === 'active' ? 'Deactivate' : 'Activate'}
                    >
                      {u.status === 'active' ? <UserX size={16} /> : <UserCheck size={16} />}
                    </button>
                    {/* Resend invite — only for users who haven't logged in yet */}
                    {!(u as unknown as { auth_user_id: string | null }).auth_user_id && (
                      <button
                        onClick={() => resendInvite.mutate(u.email)}
                        disabled={resendInvite.isPending}
                        className="rounded p-1 text-amber-400 hover:text-amber-600 disabled:opacity-50"
                        title="Resend invite email"
                      >
                        <Send size={14} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
