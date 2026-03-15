import { useState, useMemo } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Send,
  X,
  Clock,
  MapPin,
  AlertCircle,
} from 'lucide-react'
import { getWeekStart, getWeekDays, toISODate, formatWeekRange, formatTime, timeDiffMinutes, formatMinutes } from '@/lib/dateUtils'
import {
  useWeekRotaShifts,
  useCreateRotaShift,
  useUpdateRotaShift,
  useCancelRotaShift,
  usePublishWeekShifts,
  useWeekUnavailability,
  useRotaWeek,
  ROTA_STATUS_COLOURS,
  ROTA_STATUS_LABELS,
  type RotaShiftWithStaff,
  type RotaShiftPayload,
} from '@/hooks/useRotaShifts'
import { cn } from '@/lib/utils'

// ── Day header labels ─────────────────────────────────────────────────────────

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

// ── Shift form modal ──────────────────────────────────────────────────────────

interface ShiftFormProps {
  staffId: string
  staffName: string
  shiftDate: string
  existing?: RotaShiftWithStaff
  onClose: () => void
}

function ShiftFormModal({ staffId, staffName, shiftDate, existing, onClose }: ShiftFormProps) {
  const [startTime, setStartTime] = useState(existing?.start_time?.slice(0, 5) ?? '09:00')
  const [endTime, setEndTime] = useState(existing?.end_time?.slice(0, 5) ?? '17:00')
  const [breakMins, setBreakMins] = useState(existing?.break_mins ?? 30)
  const [notes, setNotes] = useState(existing?.notes ?? '')
  const [status, setStatus] = useState<'draft' | 'tentative' | 'confirmed'>(
    (existing?.status === 'cancelled' ? 'draft' : existing?.status ?? 'draft') as 'draft' | 'tentative' | 'confirmed',
  )
  const [error, setError] = useState<string | null>(null)

  const create = useCreateRotaShift()
  const update = useUpdateRotaShift()
  const isPending = create.isPending || update.isPending

  const totalMins = timeDiffMinutes(startTime + ':00', endTime + ':00')
  const netMins = Math.max(0, totalMins - breakMins)

  async function handleSave() {
    setError(null)
    if (!startTime || !endTime) { setError('Start and end times are required.'); return }
    if (totalMins <= 0) { setError('End time must be after start time.'); return }

    const payload: RotaShiftPayload = {
      staff_id: staffId,
      shift_date: shiftDate,
      start_time: startTime + ':00',
      end_time: endTime + ':00',
      break_mins: breakMins,
      location_id: null,
      notes: notes.trim() || null,
      status,
    }

    try {
      if (existing) {
        await update.mutateAsync({ id: existing.id, ...payload })
      } else {
        await create.mutateAsync(payload)
      }
      onClose()
    } catch (e) {
      setError((e as Error).message ?? 'Failed to save shift.')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-md rounded-xl bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">
              {existing ? 'Edit shift' : 'Add shift'}
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {staffName} · {new Date(shiftDate + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
            </p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="space-y-4 p-5">
          {/* Times */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Start time</label>
              <input
                type="time"
                value={startTime}
                onChange={e => setStartTime(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">End time</label>
              <input
                type="time"
                value={endTime}
                onChange={e => setEndTime(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* Duration display */}
          {totalMins > 0 && (
            <div className="flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600">
              <Clock size={13} />
              <span>{formatMinutes(totalMins)} gross</span>
              <span className="text-gray-400">·</span>
              <span>{formatMinutes(netMins)} net after {breakMins}m break</span>
            </div>
          )}

          {/* Break */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Break (minutes)</label>
            <input
              type="number"
              min={0}
              max={120}
              step={5}
              value={breakMins}
              onChange={e => setBreakMins(Number(e.target.value))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Status */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Status</label>
            <select
              value={status}
              onChange={e => setStatus(e.target.value as 'draft' | 'tentative' | 'confirmed')}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="draft">Draft</option>
              <option value="tentative">Tentative</option>
              <option value="confirmed">Confirmed</option>
            </select>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Notes (optional)</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              placeholder="Any notes for this shift…"
              className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
              <AlertCircle size={13} />
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 border-t border-gray-200 px-5 py-4">
          <button
            onClick={onClose}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isPending}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {isPending ? 'Saving…' : 'Save shift'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Shift chip ────────────────────────────────────────────────────────────────

interface ShiftChipProps {
  shift: RotaShiftWithStaff
  onClick: () => void
  onCancel: () => void
}

function ShiftChip({ shift, onClick, onCancel }: ShiftChipProps) {
  const [showCancel, setShowCancel] = useState(false)
  const net = Math.max(0, timeDiffMinutes(shift.start_time, shift.end_time) - shift.break_mins)

  return (
    <div
      className={cn(
        'group relative mb-1 rounded border px-2 py-1 text-xs cursor-pointer transition-all',
        ROTA_STATUS_COLOURS[shift.status],
      )}
      onMouseEnter={() => setShowCancel(true)}
      onMouseLeave={() => setShowCancel(false)}
      onClick={onClick}
    >
      <div className="font-medium">
        {formatTime(shift.start_time)}–{formatTime(shift.end_time)}
      </div>
      <div className="text-[10px] opacity-70">{formatMinutes(net)} net</div>
      {showCancel && (
        <button
          onClick={e => { e.stopPropagation(); onCancel() }}
          className="absolute right-1 top-1 rounded p-0.5 hover:bg-black/10"
        >
          <X size={10} />
        </button>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function RotaBuilder() {
  const [weekOffset, setWeekOffset] = useState(0)
  const today = new Date()
  const baseMonday = getWeekStart(today)
  const weekStart = new Date(baseMonday)
  weekStart.setDate(baseMonday.getDate() + weekOffset * 7)

  const weekDays = getWeekDays(weekStart)

  const { data: shifts = [], isLoading: shiftsLoading } = useWeekRotaShifts(weekStart)
  const { data: unavailability = [] } = useWeekUnavailability(weekStart)
  const { data: rotaWeek } = useRotaWeek(weekStart)
  const publish = usePublishWeekShifts()
  const cancel = useCancelRotaShift()

  // Modal state
  const [modal, setModal] = useState<{
    staffId: string
    staffName: string
    shiftDate: string
    existing?: RotaShiftWithStaff
  } | null>(null)

  // Build unique staff list from shifts (sorted by name)
  const staffList = useMemo(() => {
    const map = new Map<string, string>()
    for (const s of shifts) {
      if (s.users) {
        map.set(s.users.id, `${s.users.first_name} ${s.users.last_name}`)
      }
    }
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [shifts])

  // Index: staffId → dateStr → shifts[]
  const shiftIndex = useMemo(() => {
    const idx = new Map<string, Map<string, RotaShiftWithStaff[]>>()
    for (const s of shifts) {
      const sid = s.staff_id
      if (!idx.has(sid)) idx.set(sid, new Map())
      const dayMap = idx.get(sid)!
      if (!dayMap.has(s.shift_date)) dayMap.set(s.shift_date, [])
      dayMap.get(s.shift_date)!.push(s)
    }
    return idx
  }, [shifts])

  // Index: staffId → Set of unavailable dates
  const unavailIndex = useMemo(() => {
    const idx = new Map<string, Set<string>>()
    for (const u of unavailability) {
      if (!u.users) continue
      const sid = u.staff_id
      if (!idx.has(sid)) idx.set(sid, new Set())
      const set = idx.get(sid)!
      // Fill every date in the range
      const start = new Date(u.start_date + 'T00:00:00')
      const end = new Date(u.end_date + 'T00:00:00')
      const d = new Date(start)
      while (d <= end) {
        set.add(toISODate(d))
        d.setDate(d.getDate() + 1)
      }
    }
    return idx
  }, [unavailability])

  const isLocked = !!rotaWeek?.locked_at
  const weekHasShifts = shifts.length > 0
  const unpublishedCount = shifts.filter(s => s.status === 'draft' || s.status === 'tentative').length

  function openAddModal(staffId: string, staffName: string, shiftDate: string) {
    if (isLocked) return
    setModal({ staffId, staffName, shiftDate })
  }

  function openEditModal(shift: RotaShiftWithStaff) {
    if (isLocked) return
    const name = shift.users ? `${shift.users.first_name} ${shift.users.last_name}` : '—'
    setModal({ staffId: shift.staff_id, staffName: name, shiftDate: shift.shift_date, existing: shift })
  }

  async function handleCancel(shiftId: string) {
    if (!confirm('Cancel this shift?')) return
    await cancel.mutateAsync({ id: shiftId, reason: 'Removed by manager' })
  }

  async function handlePublish() {
    if (!confirm(`Publish all ${unpublishedCount} draft/tentative shifts for this week? Staff will be able to see and acknowledge them.`)) return
    await publish.mutateAsync(weekStart)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h1 className="text-xl font-semibold text-gray-900">Rota Builder</h1>
        <div className="flex items-center gap-3">
          {/* Week nav */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setWeekOffset(o => o - 1)}
              className="rounded-lg border border-gray-300 p-1.5 text-gray-500 hover:bg-gray-50"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="min-w-40 text-center text-sm text-gray-700 font-medium">
              {formatWeekRange(weekStart)}
            </span>
            <button
              onClick={() => setWeekOffset(o => o + 1)}
              className="rounded-lg border border-gray-300 p-1.5 text-gray-500 hover:bg-gray-50"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          {/* Publish button */}
          {unpublishedCount > 0 && !isLocked && (
            <button
              onClick={handlePublish}
              disabled={publish.isPending}
              className="flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              <Send size={14} />
              Publish {unpublishedCount} shift{unpublishedCount !== 1 ? 's' : ''}
            </button>
          )}

          {isLocked && (
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700">
              Week published
            </span>
          )}
        </div>
      </div>

      {/* Status legend */}
      <div className="mb-3 flex items-center gap-3 text-xs">
        {(Object.entries(ROTA_STATUS_LABELS) as [RotaShiftWithStaff['status'], string][])
          .filter(([k]) => k !== 'cancelled')
          .map(([key, label]) => (
            <span
              key={key}
              className={cn('rounded border px-2 py-0.5', ROTA_STATUS_COLOURS[key])}
            >
              {label}
            </span>
          ))}
        <span className="ml-auto text-gray-400">
          {shifts.length} shift{shifts.length !== 1 ? 's' : ''} this week
        </span>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-auto rounded-xl border border-gray-200 bg-white">
        {shiftsLoading ? (
          <div className="flex items-center justify-center h-40 text-sm text-gray-400">
            Loading rota…
          </div>
        ) : (
          <table className="w-full min-w-[800px] border-collapse">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="w-40 px-3 py-2 text-left text-xs font-semibold text-gray-500">Staff</th>
                {weekDays.map((d, i) => {
                  const dateStr = toISODate(d)
                  const isToday = dateStr === toISODate(today)
                  return (
                    <th
                      key={dateStr}
                      className={cn(
                        'px-2 py-2 text-center text-xs font-semibold text-gray-500 min-w-[110px]',
                        isToday && 'bg-emerald-50 text-emerald-700',
                      )}
                    >
                      <div>{DAY_LABELS[i]}</div>
                      <div className={cn('text-[11px] font-normal', isToday ? 'text-emerald-600' : 'text-gray-400')}>
                        {d.getDate()} {d.toLocaleDateString('en-GB', { month: 'short' })}
                      </div>
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {staffList.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-sm text-gray-400">
                    No shifts scheduled this week.
                    <br />
                    <span className="text-xs">Add staff members from the Users admin page, then add shifts below.</span>
                  </td>
                </tr>
              ) : (
                staffList.map(({ id: sid, name }) => (
                  <tr key={sid} className="border-b border-gray-100 last:border-0">
                    {/* Staff name cell */}
                    <td className="px-3 py-2 align-top">
                      <span className="text-sm font-medium text-gray-800">{name}</span>
                    </td>

                    {/* Day cells */}
                    {weekDays.map(d => {
                      const dateStr = toISODate(d)
                      const dayShifts = shiftIndex.get(sid)?.get(dateStr) ?? []
                      const isUnavail = unavailIndex.get(sid)?.has(dateStr) ?? false
                      const isToday = dateStr === toISODate(today)

                      return (
                        <td
                          key={dateStr}
                          className={cn(
                            'px-2 py-2 align-top min-w-[110px]',
                            isToday && 'bg-emerald-50/40',
                            isUnavail && dayShifts.length === 0 && 'bg-red-50',
                          )}
                        >
                          {/* Unavailability indicator */}
                          {isUnavail && (
                            <div className="mb-1 flex items-center gap-1 text-[10px] text-red-500">
                              <AlertCircle size={10} />
                              Unavailable
                            </div>
                          )}

                          {/* Existing shifts */}
                          {dayShifts.map(shift => (
                            <ShiftChip
                              key={shift.id}
                              shift={shift}
                              onClick={() => openEditModal(shift)}
                              onCancel={() => handleCancel(shift.id)}
                            />
                          ))}

                          {/* Add button */}
                          {!isLocked && (
                            <button
                              onClick={() => openAddModal(sid, name, dateStr)}
                              className="mt-0.5 flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
                            >
                              <Plus size={10} />
                              Add
                            </button>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Empty state hint when no staff have shifts */}
      {!shiftsLoading && staffList.length === 0 && weekHasShifts === false && (
        <div className="mt-4 rounded-xl border border-dashed border-gray-200 bg-gray-50 px-6 py-8 text-center">
          <MapPin className="mx-auto mb-2 text-gray-300" size={28} />
          <p className="text-sm font-medium text-gray-600">No shifts yet this week</p>
          <p className="mt-1 text-xs text-gray-400">
            Staff members will appear here once they have at least one shift scheduled.
            <br />
            Use the <strong>+ Add</strong> buttons in each cell to create shifts.
          </p>
        </div>
      )}

      {/* Modal */}
      {modal && (
        <ShiftFormModal
          staffId={modal.staffId}
          staffName={modal.staffName}
          shiftDate={modal.shiftDate}
          existing={modal.existing}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  )
}
