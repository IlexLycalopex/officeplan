import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { Download } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { isoDateString } from '@/lib/utils'
import type { Views } from '@/types/database'
import { format, subDays } from 'date-fns'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any

function useDailyOccupancy(officeId: string | null, from: string, to: string) {
  return useQuery({
    queryKey: ['report', 'daily-occupancy', officeId, from, to],
    enabled: !!officeId,
    queryFn: async (): Promise<Views<'v_daily_occupancy'>[]> => {
      let q = sb
        .from('v_daily_occupancy')
        .select('*')
        .gte('booking_date', from)
        .lte('booking_date', to)
        .order('booking_date')
      if (officeId) q = q.eq('office_id', officeId)
      const { data, error } = await q
      if (error) throw error
      return (data ?? []) as unknown as Views<'v_daily_occupancy'>[]
    },
  })
}

function useUtilisation(officeId: string | null) {
  return useQuery({
    queryKey: ['report', 'utilisation', officeId],
    queryFn: async (): Promise<Views<'v_utilisation'>[]> => {
      const { data, error } = await sb
        .from('v_utilisation')
        .select('*')
        .order('utilisation_pct_30d', { ascending: false })
        .limit(20)
      if (error) throw error
      return (data ?? []) as unknown as Views<'v_utilisation'>[]
    },
  })
}

function useOfficeList() {
  return useQuery({
    queryKey: ['offices'],
    queryFn: async (): Promise<Array<{ id: string; name: string }>> => {
      const { data, error } = await sb.from('offices').select('id, name').eq('active_flag', true)
      if (error) throw error
      return (data ?? []) as unknown as Array<{ id: string; name: string }>
    },
  })
}

export default function Reports() {
  const { data: offices } = useOfficeList()
  const [officeId, setOfficeId] = useState<string | null>(null)
  const to = isoDateString(new Date())
  const from = isoDateString(subDays(new Date(), 14))

  const { data: occupancy } = useDailyOccupancy(officeId, from, to)
  const { data: utilisation } = useUtilisation(officeId)

  function exportCSV(rows: object[], filename: string) {
    if (!rows?.length) return
    const keys = Object.keys(rows[0])
    const csv = [keys.join(','), ...rows.map(r => keys.map(k => JSON.stringify((r as Record<string, unknown>)[k] ?? '')).join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Reports</h1>
        <select
          value={officeId ?? ''}
          onChange={e => setOfficeId(e.target.value || null)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="">All offices</option>
          {offices?.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>
      </div>

      {/* Daily occupancy chart */}
      <section className="rounded-xl border border-gray-200 bg-white p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700">Daily Desk Occupancy (last 14 days)</h2>
          <button
            onClick={() => exportCSV(occupancy ?? [], 'daily-occupancy.csv')}
            className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50"
          >
            <Download size={12} /> Export CSV
          </button>
        </div>
        {occupancy && occupancy.length > 0 ? (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={occupancy.map(r => ({
              date: r.booking_date ? format(new Date(r.booking_date), 'd MMM') : '',
              booked: Number(r.desks_booked ?? 0),
              total: Number(r.desks_total ?? 0),
            }))}>
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="booked" fill="#3b82f6" name="Booked" />
              <Bar dataKey="total" fill="#e5e7eb" name="Available" />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-40 items-center justify-center text-sm text-gray-400">
            {officeId ? 'No data for selected period.' : 'Select an office to view data.'}
          </div>
        )}
      </section>

      {/* Utilisation table */}
      <section className="rounded-xl border border-gray-200 bg-white p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700">Asset Utilisation (last 30 days)</h2>
          <button
            onClick={() => exportCSV(utilisation ?? [], 'utilisation.csv')}
            className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50"
          >
            <Download size={12} /> Export CSV
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs text-gray-500">
                <th className="pb-2 font-medium">Asset</th>
                <th className="pb-2 font-medium">Type</th>
                <th className="pb-2 font-medium">Office / Floor</th>
                <th className="pb-2 text-right font-medium">Bookings (30d)</th>
                <th className="pb-2 text-right font-medium">Utilisation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(utilisation ?? []).map(r => (
                <tr key={r.asset_id} className="hover:bg-gray-50">
                  <td className="py-2 font-medium text-gray-900">{r.name ?? r.code}</td>
                  <td className="py-2 text-gray-500 capitalize">{r.asset_type}</td>
                  <td className="py-2 text-gray-500">{r.office_name} / {r.floor_name}</td>
                  <td className="py-2 text-right text-gray-700">{r.bookings_last_30d}</td>
                  <td className="py-2 text-right">
                    <span className={`font-medium ${
                      Number(r.utilisation_pct_30d ?? 0) >= 70 ? 'text-green-600'
                      : Number(r.utilisation_pct_30d ?? 0) >= 30 ? 'text-amber-600'
                      : 'text-red-500'
                    }`}>
                      {r.utilisation_pct_30d ?? 0}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!utilisation?.length && (
            <p className="py-8 text-center text-sm text-gray-400">No utilisation data yet.</p>
          )}
        </div>
      </section>
    </div>
  )
}
