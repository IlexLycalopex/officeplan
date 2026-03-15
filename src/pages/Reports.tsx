import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts'
import { Download } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { isoDateString } from '@/lib/utils'
import { toISODate, getWeekStart, getWeekDays, formatMinutes, timeDiffMinutes } from '@/lib/dateUtils'
import type { Views } from '@/types/database'
import { format, subDays, subWeeks, startOfWeek } from 'date-fns'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any

// ── Space data hooks (existing) ───────────────────────────────────────────────

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

// ── Workforce data hooks (new) ─────────────────────────────────────────────────

interface TimesheetSummaryRow {
  id: string
  staff_id: string
  shift_date: string
  start_time: string
  end_time: string
  break_duration_minutes: number
  break_compliant: boolean
  status: string
  users: { first_name: string; last_name: string } | null
}

function useTimesheetWorkforceSummary(from: string, to: string) {
  return useQuery({
    queryKey: ['report', 'workforce', 'timesheets', from, to],
    queryFn: async (): Promise<TimesheetSummaryRow[]> => {
      const { data, error } = await sb
        .from('timesheets')
        .select('id, staff_id, shift_date, start_time, end_time, break_duration_minutes, break_compliant, status, users(first_name, last_name)')
        .gte('shift_date', from)
        .lte('shift_date', to)
        .is('deleted_at', null)
        .in('status', ['submitted', 'approved'])
        .order('shift_date')
      if (error) throw error
      return (data ?? []) as TimesheetSummaryRow[]
    },
  })
}

interface RotaShiftSummaryRow {
  shift_date: string
  status: string
}

function useRotaCoverageSummary(from: string, to: string) {
  return useQuery({
    queryKey: ['report', 'workforce', 'rota', from, to],
    queryFn: async (): Promise<RotaShiftSummaryRow[]> => {
      const { data, error } = await sb
        .from('rota_shifts')
        .select('shift_date, status')
        .gte('shift_date', from)
        .lte('shift_date', to)
        .neq('status', 'cancelled')
      if (error) throw error
      return (data ?? []) as RotaShiftSummaryRow[]
    },
  })
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function exportCSV(rows: object[], filename: string) {
  if (!rows?.length) return
  const keys = Object.keys(rows[0])
  const csv = [
    keys.join(','),
    ...rows.map(r => keys.map(k => JSON.stringify((r as Record<string, unknown>)[k] ?? '')).join(',')),
  ].join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// Get Mon-start of the week containing date d
function getMondayOf(d: Date): Date {
  return startOfWeek(d, { weekStartsOn: 1 })
}

// ── Space tab ─────────────────────────────────────────────────────────────────

function SpaceTab() {
  const { data: offices } = useOfficeList()
  const [officeId, setOfficeId] = useState<string | null>(null)
  const to = isoDateString(new Date())
  const from = isoDateString(subDays(new Date(), 14))

  const { data: occupancy } = useDailyOccupancy(officeId, from, to)
  const { data: utilisation } = useUtilisation(officeId)

  return (
    <div className="space-y-6">
      {/* Office filter */}
      <div className="flex justify-end">
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

// ── Workforce tab ──────────────────────────────────────────────────────────────

const BREAK_COLOURS = ['#10b981', '#f59e0b']

function WorkforceTab() {
  // Last 4 complete weeks + current week
  const today = new Date()
  const currentWeekStart = getMondayOf(today)
  const fourWeeksAgo = getMondayOf(subWeeks(today, 4))
  const from = toISODate(fourWeeksAgo)
  const to = toISODate(today)

  // Current week for rota coverage
  const weekDays = getWeekDays(getWeekStart(today))
  const rotaFrom = toISODate(weekDays[0])
  const rotaTo = toISODate(weekDays[6])

  const { data: timesheets = [] } = useTimesheetWorkforceSummary(from, to)
  const { data: rotaShifts = [] } = useRotaCoverageSummary(rotaFrom, rotaTo)

  // ── Weekly hours chart data ─────────────────────────────────────────────────
  // Build 5 weeks worth of buckets (4 past + current)
  const weeks: { label: string; start: Date }[] = []
  for (let i = 4; i >= 0; i--) {
    const ws = getMondayOf(subWeeks(today, i))
    weeks.push({
      label: format(ws, 'd MMM'),
      start: ws,
    })
  }

  const weeklyHoursData = weeks.map(({ label, start }) => {
    const end = new Date(start)
    end.setDate(start.getDate() + 6)
    const weekSheets = timesheets.filter(t => {
      const d = t.shift_date
      return d >= toISODate(start) && d <= toISODate(end)
    })
    const approvedMins = weekSheets
      .filter(t => t.status === 'approved')
      .reduce((sum, t) => sum + Math.max(0, timeDiffMinutes(t.start_time, t.end_time) - t.break_duration_minutes), 0)
    const pendingMins = weekSheets
      .filter(t => t.status === 'submitted')
      .reduce((sum, t) => sum + Math.max(0, timeDiffMinutes(t.start_time, t.end_time) - t.break_duration_minutes), 0)
    return {
      label,
      approved: Math.round(approvedMins / 60 * 10) / 10,
      pending: Math.round(pendingMins / 60 * 10) / 10,
    }
  })

  // ── Break compliance ────────────────────────────────────────────────────────
  const totalWithRule = timesheets.length
  const compliantCount = timesheets.filter(t => t.break_compliant).length
  const nonCompliantCount = totalWithRule - compliantCount
  const compliancePct = totalWithRule > 0 ? Math.round((compliantCount / totalWithRule) * 100) : null

  const breakPieData = totalWithRule > 0
    ? [
        { name: 'Compliant', value: compliantCount },
        { name: 'Non-compliant', value: nonCompliantCount },
      ]
    : []

  // ── Per-person hours (current week) ────────────────────────────────────────
  const currentWeekSheets = timesheets.filter(
    t => t.shift_date >= toISODate(currentWeekStart) && t.shift_date <= to,
  )
  const perPersonMap = new Map<string, { name: string; approvedMins: number; pendingMins: number; shiftCount: number }>()
  for (const t of currentWeekSheets) {
    const name = t.users ? `${t.users.first_name} ${t.users.last_name}` : t.staff_id
    if (!perPersonMap.has(t.staff_id)) {
      perPersonMap.set(t.staff_id, { name, approvedMins: 0, pendingMins: 0, shiftCount: 0 })
    }
    const entry = perPersonMap.get(t.staff_id)!
    const netMins = Math.max(0, timeDiffMinutes(t.start_time, t.end_time) - t.break_duration_minutes)
    if (t.status === 'approved') entry.approvedMins += netMins
    else entry.pendingMins += netMins
    entry.shiftCount++
  }
  const perPerson = Array.from(perPersonMap.values()).sort((a, b) =>
    b.approvedMins + b.pendingMins - (a.approvedMins + a.pendingMins),
  )

  // ── Rota coverage (current week) ───────────────────────────────────────────
  const rotaCoverage = weekDays.map(d => {
    const dateStr = toISODate(d)
    const dayShifts = rotaShifts.filter(s => s.shift_date === dateStr)
    return {
      date: format(d, 'EEE d'),
      confirmed: dayShifts.filter(s => s.status === 'confirmed').length,
      tentative: dayShifts.filter(s => s.status === 'tentative').length,
      draft: dayShifts.filter(s => s.status === 'draft').length,
    }
  })

  const csvTimesheets = timesheets.map(t => ({
    name: t.users ? `${t.users.first_name} ${t.users.last_name}` : t.staff_id,
    date: t.shift_date,
    start: t.start_time,
    end: t.end_time,
    break_mins: t.break_duration_minutes,
    net_hours: (Math.max(0, timeDiffMinutes(t.start_time, t.end_time) - t.break_duration_minutes) / 60).toFixed(2),
    break_compliant: t.break_compliant,
    status: t.status,
  }))

  return (
    <div className="space-y-6">
      {/* Summary stat cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard
          label="Timesheets (5 wks)"
          value={String(totalWithRule)}
          sub="submitted + approved"
          colour="blue"
        />
        <StatCard
          label="Break compliance"
          value={compliancePct !== null ? `${compliancePct}%` : '—'}
          sub={compliancePct !== null ? `${nonCompliantCount} non-compliant` : 'No data'}
          colour={compliancePct !== null && compliancePct >= 90 ? 'green' : compliancePct !== null && compliancePct >= 70 ? 'amber' : 'red'}
        />
        <StatCard
          label="Rota shifts (this week)"
          value={String(rotaShifts.length)}
          sub={`${rotaShifts.filter(s => s.status === 'confirmed').length} confirmed`}
          colour="emerald"
        />
        <StatCard
          label="Staff with hours (wk)"
          value={String(perPerson.length)}
          sub="current week"
          colour="purple"
        />
      </div>

      {/* Weekly hours chart */}
      <section className="rounded-xl border border-gray-200 bg-white p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-gray-700">Approved & Pending Hours per Week</h2>
            <p className="text-xs text-gray-400 mt-0.5">All staff · last 5 weeks</p>
          </div>
          <button
            onClick={() => exportCSV(csvTimesheets, 'timesheet-hours.csv')}
            className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50"
          >
            <Download size={12} /> Export CSV
          </button>
        </div>
        {weeklyHoursData.some(w => w.approved + w.pending > 0) ? (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={weeklyHoursData}>
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} unit="h" />
              <Tooltip formatter={(v: number) => [`${v}h`, '']} />
              <Bar dataKey="approved" stackId="a" fill="#10b981" name="Approved" />
              <Bar dataKey="pending" stackId="a" fill="#fbbf24" name="Pending" radius={[4, 4, 0, 0]} />
              <Legend />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-40 items-center justify-center text-sm text-gray-400">
            No timesheet data for the last 5 weeks.
          </div>
        )}
      </section>

      {/* Break compliance pie */}
      <div className="grid gap-4 sm:grid-cols-2">
        <section className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="mb-4 text-sm font-semibold text-gray-700">Break Compliance (5 weeks)</h2>
          {breakPieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie
                  data={breakPieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={75}
                  paddingAngle={3}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${Math.round(percent * 100)}%`}
                  labelLine={false}
                >
                  {breakPieData.map((_entry, i) => (
                    <Cell key={i} fill={BREAK_COLOURS[i % BREAK_COLOURS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-40 items-center justify-center text-sm text-gray-400">
              No timesheet data yet.
            </div>
          )}
        </section>

        {/* Rota coverage */}
        <section className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="mb-4 text-sm font-semibold text-gray-700">Rota Coverage — This Week</h2>
          <div className="space-y-2">
            {rotaCoverage.map(day => {
              const total = day.confirmed + day.tentative + day.draft
              return (
                <div key={day.date} className="flex items-center gap-3 text-sm">
                  <span className="w-14 shrink-0 text-xs text-gray-500">{day.date}</span>
                  {total === 0 ? (
                    <span className="text-xs text-gray-300">No shifts</span>
                  ) : (
                    <div className="flex flex-1 items-center gap-1.5 flex-wrap">
                      {day.confirmed > 0 && (
                        <span className="rounded-full border border-emerald-200 bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700">
                          {day.confirmed} confirmed
                        </span>
                      )}
                      {day.tentative > 0 && (
                        <span className="rounded-full border border-yellow-200 bg-yellow-100 px-2 py-0.5 text-xs text-yellow-700">
                          {day.tentative} tentative
                        </span>
                      )}
                      {day.draft > 0 && (
                        <span className="rounded-full border border-gray-200 bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                          {day.draft} draft
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </section>
      </div>

      {/* Per-person hours table (current week) */}
      {perPerson.length > 0 && (
        <section className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="mb-4 text-sm font-semibold text-gray-700">Staff Hours — Current Week</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs text-gray-500">
                  <th className="pb-2 font-medium">Staff member</th>
                  <th className="pb-2 text-right font-medium">Shifts</th>
                  <th className="pb-2 text-right font-medium">Approved</th>
                  <th className="pb-2 text-right font-medium">Pending</th>
                  <th className="pb-2 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {perPerson.map((p, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="py-2 font-medium text-gray-900">{p.name}</td>
                    <td className="py-2 text-right text-gray-600">{p.shiftCount}</td>
                    <td className="py-2 text-right text-emerald-700">{formatMinutes(p.approvedMins)}</td>
                    <td className="py-2 text-right text-amber-600">{formatMinutes(p.pendingMins)}</td>
                    <td className="py-2 text-right font-semibold text-gray-900">
                      {formatMinutes(p.approvedMins + p.pendingMins)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  )
}

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({
  label, value, sub, colour,
}: {
  label: string
  value: string
  sub: string
  colour: 'blue' | 'green' | 'amber' | 'red' | 'emerald' | 'purple'
}) {
  const colours = {
    blue: 'text-blue-700',
    green: 'text-green-700',
    amber: 'text-amber-600',
    red: 'text-red-600',
    emerald: 'text-emerald-700',
    purple: 'text-purple-700',
  }
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${colours[colour]}`}>{value}</p>
      <p className="mt-0.5 text-xs text-gray-400">{sub}</p>
    </div>
  )
}

// ── Main Reports page ─────────────────────────────────────────────────────────

type Tab = 'space' | 'workforce'

export default function Reports() {
  const [tab, setTab] = useState<Tab>('space')

  return (
    <div className="max-w-5xl space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Reports</h1>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 rounded-xl border border-gray-200 bg-gray-50 p-1 w-fit">
        {([['space', 'Space & Bookings'], ['workforce', 'Workforce']] as [Tab, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              tab === key
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'space' ? <SpaceTab /> : <WorkforceTab />}
    </div>
  )
}
