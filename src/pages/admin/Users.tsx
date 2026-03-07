import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Search, UserX, UserCheck } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { Tables } from '@/types/database'

type User = Tables<'users'>

function useAllUsers() {
  return useQuery({
    queryKey: ['admin', 'users'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('users')
        .select(`*, departments(name), teams(name), offices:primary_office_id(name)`)
        .order('last_name')
      if (error) throw error
      return data
    },
  })
}

export default function AdminUsers() {
  const { data: users, isLoading } = useAllUsers()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')

  const toggleStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: 'active' | 'inactive' }) => {
      const { error } = await supabase.from('users').update({ status }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'users'] }),
  })

  const changeRole = useMutation({
    mutationFn: async ({ id, role }: { id: string; role: User['role'] }) => {
      const { error } = await supabase.from('users').update({ role }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'users'] }),
  })

  const filtered = (users ?? []).filter(u =>
    `${u.first_name} ${u.last_name} ${u.email}`.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="max-w-6xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Users</h1>
        <p className="text-sm text-gray-500">{users?.length ?? 0} total</p>
      </div>

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
              {['Name', 'Email', 'Department / Team', 'Role', 'Status', 'Actions'].map(h => (
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
                <td className="px-4 py-3 text-sm font-medium text-gray-900">
                  {u.first_name} {u.last_name}
                  <div className="text-xs text-gray-400">{u.job_title}</div>
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">{u.email}</td>
                <td className="px-4 py-3 text-sm text-gray-500">
                  {(u.departments as { name?: string } | null)?.name}
                  {(u.teams as { name?: string } | null)?.name && (
                    <div className="text-xs">{(u.teams as { name: string }).name}</div>
                  )}
                </td>
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
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
