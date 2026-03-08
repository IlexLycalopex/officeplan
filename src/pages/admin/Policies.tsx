import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, X, ChevronLeft, ChevronRight } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { format, addMonths, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameMonth, isBefore, startOfDay } from 'date-fns'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

// ── Hooks ──────────────────────────────────────────────────────────────────────

function usePolicies() {
  return useQuery({
    queryKey: ['admin', 'policies'],
    queryFn: async () => {
      const { data, error } = await sb.from('policies').select('*').single()
      if (error && error.code !== 'PGRST116') throw error
      return data ?? null
    },
  })
}

function useClosedDates() {
  return useQuery({
    queryKey: ['admin', 'closed_dates'],
    queryFn: async () => {
      const { data, error } = await sb
        .from('closed_dates')
        .select('*')
        .gte('close_date', format(new Date(), 'yyyy-MM-dd'))
        .order('close_date')
      if (error) throw error
      return (data ?? []) as { id: string; close_date: string; reason: string | null; office_id: string | null }[]
    },
  })
}

function useOfficeList() {
  return useQuery({
    queryKey: ['offices', 'list'],
    queryFn: async () => {
      const { data, error } = await sb.from('offices').select('id, name').eq('active_flag', true).order('name')
      if (error) throw error
      return (data ?? []) as { id: string; name: string }[]
    },
  })
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function AdminPolicies() {
  const qc = useQueryClient()
  const { data: policy, isLoading } = usePolicies()
  const { data: closedDates } = useClosedDates()
  const { data: officeList } = useOfficeList()

  // Booking window form state
  const [selfWindow, setSelfWindow] = useState(14)
  const [maxWindow, setMaxWindow] = useState(180)
  const [cancelCutoff, setCancelCutoff] = useState(0)
  const [workingDays, setWorkingDays] = useState<number[]>([1, 2, 3, 4, 5])
  const [policySaved, setPolicySaved] = useState(false)

  useEffect(() => {
    if (policy) {
      setSelfWindow(policy.self_book_window_days ?? 14)
      setMaxWindow(policy.max_booking_window_days ?? 180)
      setCancelCutoff(policy.cancellation_cutoff_hours ?? 0)
      setWorkingDays(policy.working_days ?? [1, 2, 3, 4, 5])
    }
  }, [policy])

  // Closed date add state
  const [calMonth, setCalMonth] = useState(new Date())
  const [pendingDate, setPendingDate] = useState<string | null>(null)
  const [pendingReason, setPendingReason] = useState('')
  const [pendingOfficeId, setPendingOfficeId] = useState<string>('')

  const savePolicy = useMutation({
    mutationFn: async () => {
      const { error } = await sb.from('policies').upsert({
        ...(policy?.id ? { id: policy.id } : {}),
        self_book_window_days: selfWindow,
        max_booking_window_days: maxWindow,
        cancellation_cutoff_hours: cancelCutoff,
        working_days: workingDays,
      }, { onConflict: 'organisation_id' })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'policies'] })
      setPolicySaved(true)
      setTimeout(() => setPolicySaved(false), 3000)
    },
  })

  const addClosedDate = useMutation({
    mutationFn: async () => {
      if (!pendingDate) return
      const { error } = await sb.from('closed_dates').insert({
        close_date: pendingDate,
        reason: pendingReason || null,
        office_id: pendingOfficeId || null,
      })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'closed_dates'] })
      setPendingDate(null)
      setPendingReason('')
      setPendingOfficeId('')
    },
  })

  const removeClosedDate = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb.from('closed_dates').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'closed_dates'] }),
  })

  function toggleWorkingDay(day: number) {
    setWorkingDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day].sort(),
    )
  }

  // Calendar helpers
  const monthStart = startOfMonth(calMonth)
  const monthEnd   = endOfMonth(calMonth)
  const calDays    = eachDayOfInterval({ start: monthStart, end: monthEnd })
  const startPad   = getDay(monthStart) // 0=Sun
  const closedSet  = new Set((closedDates ?? []).map(d => d.close_date))
  const today      = startOfDay(new Date())

  function handleCalDayClick(date: Date) {
    const ds = format(date, 'yyyy-MM-dd')
    if (isBefore(date, today)) return
    if (closedSet.has(ds)) {
      // Remove existing entry
      const entry = (closedDates ?? []).find(d => d.close_date === ds)
      if (entry) removeClosedDate.mutate(entry.id)
    } else {
      setPendingDate(ds)
      setPendingReason('')
      setPendingOfficeId('')
    }
  }

  if (isLoading) return <p className="text-sm text-gray-500">Loading…</p>

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-xl font-semibold text-gray-900">Booking Policies</h1>

      {/* ── Section 1: Booking Windows ─────────────────────────────────── */}
      <section className="rounded-xl border border-gray-200 bg-white p-6 space-y-4">
        <h2 className="text-sm font-semibold text-gray-700">Booking Windows</h2>

        <PolicyRow
          label="Self-service booking window"
          description="Bookings up to this many days ahead are confirmed immediately."
          value={selfWindow}
          unit="days"
          onChange={setSelfWindow}
        />
        <PolicyRow
          label="Maximum advance booking window"
          description="Booking requests beyond this number of days are rejected."
          value={maxWindow}
          unit="days"
          onChange={setMaxWindow}
        />
        <PolicyRow
          label="Cancellation cut-off"
          description="Bookings cannot be cancelled within this many hours of the booking date."
          value={cancelCutoff}
          unit="hours"
          onChange={setCancelCutoff}
        />

        {/* ── Section 2: Working Days ───────────────────────────────────── */}
        <div className="border-t border-gray-100 pt-4">
          <h2 className="mb-1 text-sm font-semibold text-gray-700">Working Days</h2>
          <p className="mb-3 text-xs text-gray-500">Days counted when calculating desk utilisation in Reports.</p>
          <div className="flex gap-2">
            {DAYS.map((d, i) => (
              <button
                key={i}
                type="button"
                onClick={() => toggleWorkingDay(i)}
                className={`h-9 w-10 rounded-lg text-xs font-medium transition-colors ${
                  workingDays.includes(i)
                    ? 'bg-blue-600 text-white'
                    : 'border border-gray-300 text-gray-500 hover:bg-gray-50'
                }`}
              >
                {d}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3 border-t border-gray-100 pt-4">
          <button
            onClick={() => savePolicy.mutate()}
            disabled={savePolicy.isPending}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {savePolicy.isPending ? 'Saving…' : 'Save policies'}
          </button>
          {policySaved && <span className="text-sm text-green-600">Saved!</span>}
          {savePolicy.isError && <span className="text-sm text-red-600">Save failed.</span>}
        </div>
      </section>

      {/* ── Section 3: Office Closed Dates ────────────────────────────── */}
      <section className="rounded-xl border border-gray-200 bg-white p-6 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-gray-700">Office Closed Dates</h2>
          <p className="mt-1 text-xs text-gray-500">
            Bookings cannot be made on closed dates. Click a day to toggle it.
          </p>
        </div>

        {/* Mini calendar */}
        <div className="select-none">
          {/* Month nav */}
          <div className="flex items-center justify-between mb-3">
            <button
              onClick={() => setCalMonth(m => addMonths(m, -1))}
              className="rounded p-1 text-gray-500 hover:bg-gray-100"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-sm font-medium text-gray-800">
              {format(calMonth, 'MMMM yyyy')}
            </span>
            <button
              onClick={() => setCalMonth(m => addMonths(m, 1))}
              className="rounded p-1 text-gray-500 hover:bg-gray-100"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          {/* Day-of-week headers */}
          <div className="grid grid-cols-7 text-center text-[10px] font-medium text-gray-400 mb-1">
            {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
              <div key={d}>{d}</div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-1">
            {/* Leading empty cells */}
            {Array.from({ length: startPad }).map((_, i) => <div key={`pad-${i}`} />)}
            {calDays.map(day => {
              const ds = format(day, 'yyyy-MM-dd')
              const isPast = isBefore(day, today)
              const isClosed = closedSet.has(ds)
              const isCurrentMonth = isSameMonth(day, calMonth)
              return (
                <button
                  key={ds}
                  onClick={() => handleCalDayClick(day)}
                  disabled={isPast}
                  className={`rounded-lg py-1.5 text-xs font-medium transition-colors ${
                    !isCurrentMonth ? 'text-gray-300' :
                    isClosed ? 'bg-red-500 text-white hover:bg-red-600' :
                    isPast ? 'text-gray-300 cursor-not-allowed' :
                    'hover:bg-gray-100 text-gray-700'
                  }`}
                >
                  {format(day, 'd')}
                </button>
              )
            })}
          </div>
        </div>

        {/* Add reason modal (inline) */}
        {pendingDate && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 space-y-2">
            <p className="text-sm font-medium text-red-800">
              Close {format(new Date(pendingDate + 'T00:00:00'), 'EEEE, d MMMM yyyy')}
            </p>
            <input
              placeholder="Reason (optional)"
              value={pendingReason}
              onChange={e => setPendingReason(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
            />
            <select
              value={pendingOfficeId}
              onChange={e => setPendingOfficeId(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
            >
              <option value="">All offices</option>
              {officeList?.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
            <div className="flex gap-2">
              <button
                onClick={() => addClosedDate.mutate()}
                disabled={addClosedDate.isPending}
                className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {addClosedDate.isPending ? 'Saving…' : 'Mark as closed'}
              </button>
              <button
                onClick={() => setPendingDate(null)}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-white"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Upcoming closed dates list */}
        {(closedDates ?? []).length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-medium text-gray-600 mb-2">Upcoming closed dates</p>
            {(closedDates ?? []).map(cd => (
              <div
                key={cd.id}
                className="flex items-center justify-between rounded-lg bg-red-50 px-3 py-2 text-sm"
              >
                <div>
                  <span className="font-medium text-red-800">
                    {format(new Date(cd.close_date + 'T00:00:00'), 'd MMM yyyy')}
                  </span>
                  {cd.reason && <span className="ml-2 text-red-600">· {cd.reason}</span>}
                  {cd.office_id && (
                    <span className="ml-2 text-xs text-red-500">
                      ({officeList?.find(o => o.id === cd.office_id)?.name ?? 'Specific office'})
                    </span>
                  )}
                  {!cd.office_id && <span className="ml-2 text-xs text-red-400">(all offices)</span>}
                </div>
                <button
                  onClick={() => removeClosedDate.mutate(cd.id)}
                  className="rounded p-0.5 text-red-400 hover:text-red-700"
                  title="Remove"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function PolicyRow({
  label, description, value, unit, onChange,
}: {
  label: string
  description: string
  value: number
  unit: string
  onChange: (v: number) => void
}) {
  return (
    <div className="flex items-start justify-between gap-6 border-b border-gray-100 pb-4 last:border-0 last:pb-0">
      <div className="flex-1">
        <p className="text-sm font-medium text-gray-900">{label}</p>
        <p className="text-xs text-gray-500">{description}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <input
          type="number"
          value={value}
          min={0}
          onChange={e => onChange(Number(e.target.value))}
          className="w-20 rounded-lg border border-gray-300 px-2 py-1 text-sm text-right"
        />
        <span className="text-sm text-gray-500">{unit}</span>
      </div>
    </div>
  )
}

// Unused import suppression
const _Plus = Plus
void _Plus
