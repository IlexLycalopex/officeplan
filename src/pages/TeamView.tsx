import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { format } from 'date-fns'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useTeamAttendance } from '@/hooks/useRota'
import { useAuth } from '@/stores/authStore'
import { getWeekDates, isoDateString } from '@/lib/utils'

const STATUS_BADGE: Record<string, string> = {
  in_office: 'bg-blue-100 text-blue-700',
  remote: 'bg-purple-100 text-purple-700',
  leave: 'bg-gray-100 text-gray-500',
  unavailable: 'bg-red-100 text-red-600',
  unplanned: 'bg-white text-gray-300',
}

const STATUS_LABEL: Record<string, string> = {
  in_office: 'In Office',
  remote: 'Remote',
  leave: 'Leave',
  unavailable: 'Unavailable',
  unplanned: '—',
}

type Team = { id: string; name: string; department_id: string | null }

function useTeams() {
  return useQuery({
    queryKey: ['teams'],
    queryFn: async (): Promise<Team[]> => {
      const { data, error } = await supabase
        .from('teams')
        .select('id, name, department_id')
        .eq('active_flag', true)
        .order('name')
      if (error) throw error
      return (data ?? []) as unknown as Team[]
    },
  })
}

export default function TeamView() {
  const { profile } = useAuth()
  const { data: teams } = useTeams()
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(profile?.team_id ?? null)
  const [weekOffset, setWeekOffset] = useState(0)
  const weekDates = getWeekDates(weekOffset)
  const workDays = weekDates.slice(0, 5)
  const from = isoDateString(workDays[0])
  const to = isoDateString(workDays[4])

  const { data: attendance } = useTeamAttendance(selectedTeamId, from, to)

  // Group attendance by user
  const byUser = (attendance ?? []).reduce<Record<string, Record<string, string>>>((acc, row) => {
    if (!acc[row.user_id]) acc[row.user_id] = { name: row.user_name }
    if (row.work_date) acc[row.user_id][row.work_date] = row.plan_status ?? 'unplanned'
    return acc
  }, {})

  return (
    <div className="max-w-5xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Team View</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setWeekOffset(o => o - 1)}
            disabled={weekOffset <= -4}
            className="rounded-lg border border-gray-300 p-1.5 text-gray-500 hover:bg-gray-50 disabled:opacity-30"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="min-w-36 text-center text-sm text-gray-600">
            {format(workDays[0], 'd MMM')} – {format(workDays[4], 'd MMM yyyy')}
          </span>
          <button
            onClick={() => setWeekOffset(o => o + 1)}
            className="rounded-lg border border-gray-300 p-1.5 text-gray-500 hover:bg-gray-50"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Team selector */}
      <select
        value={selectedTeamId ?? ''}
        onChange={e => setSelectedTeamId(e.target.value || null)}
        className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
      >
        <option value="">Select a team…</option>
        {teams?.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
      </select>

      {/* Attendance grid */}
      {selectedTeamId && Object.keys(byUser).length > 0 ? (
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Person</th>
                {workDays.map(d => (
                  <th key={d.toISOString()} className="px-3 py-3 text-center text-xs font-medium text-gray-500">
                    <div>{format(d, 'EEE')}</div>
                    <div className="font-normal">{format(d, 'd MMM')}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {Object.entries(byUser).map(([userId, row]) => (
                <tr key={userId} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{row.name}</td>
                  {workDays.map(d => {
                    const ds = isoDateString(d)
                    const status = row[ds] ?? 'unplanned'
                    return (
                      <td key={ds} className="px-3 py-3 text-center">
                        <span className={`rounded px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[status] ?? STATUS_BADGE.unplanned}`}>
                          {STATUS_LABEL[status] ?? '—'}
                        </span>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : selectedTeamId ? (
        <div className="flex h-40 items-center justify-center text-sm text-gray-400">
          No attendance data for this team.
        </div>
      ) : null}
    </div>
  )
}
