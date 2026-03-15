import { useState } from 'react'
import { ChevronLeft, ChevronRight, Clock, Plus, CheckCircle2, XCircle, AlertCircle, Send } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/stores/authStore'
import {
  useMyWeekTimesheets,
  useCreateTimesheet,
  useUpdateTimesheet,
  useSubmitTimesheet,
  useDeleteTimesheet,
  TIMESHEET_STATUS_COLOURS,
  TIMESHEET_STATUS_LABELS,
  type TimesheetWithLocation,
  type TimesheetPayload,
} from '@/hooks/useTimesheets'
import { useDefaultBreakRule } from '@/hooks/useBreakRules'
import {
  getWeekStart,
  getWeekDays,
  toISODate,
  formatWeekRange,
  formatTime,
  formatDate,
  formatShiftDuration,
  isToday,
} from '@/lib/dateUtils'
import {
  calculateBreakCompliance,
  complianceBadge,
  UK_DEFAULT_RULE,
  type BreakRule,
} from '@/lib/breakCompliance'

// ── Timesheet form ─────────────────────────────────────────────────────────────

interface TimesheetFormProps {
  date: string
  initial?: TimesheetWithLocation | null
  rule: BreakRule
  onSave: (payload: TimesheetPayload) => void
  onSubmit?: (id: string) => void
  onDelete?: (id: string) => void
  onCancel: () => void
  saving: boolean
}

function TimesheetForm({
  date,
  initial,
  rule,
  onSave,
  onSubmit,
  onDelete,
  onCancel,
  saving,
}: TimesheetFormProps) {
  const [startTime, setStartTime] = useState(initial ? formatTime(initial.start_time) : '09:00')
  const [endTime, setEndTime] = useState(initial ? formatTime(initial.end_time) : '17:00')
  const [breakMins, setBreakMins] = useState(String(initial?.break_duration_minutes ?? 0))
  const [locationId, _setLocationId] = useState(initial?.location_id ?? '')
  const [notes, setNotes] = useState(initial?.notes ?? '')

  const compliance =
    startTime && endTime
      ? calculateBreakCompliance(startTime, endTime, Number(breakMins) || 0, rule)
      : null

  const payload: TimesheetPayload = {
    shift_date: date,
    start_time: startTime + ':00',
    end_time: endTime + ':00',
    break_duration_minutes: Number(breakMins) || 0,
    location_id: locationId || null,
    notes: notes.trim() || null,
  }

  const canEdit = !initial || initial.status === 'draft' || initial.status === 'rejected'
  const canSubmit = initial?.status === 'draft'
  const canDelete = initial && (initial.status === 'draft' || initial.status === 'rejected')

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <h3 className="mb-4 font-semibold text-gray-900">{formatDate(date)}</h3>

      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-700">Start time</label>
          <input
            type="time"
            value={startTime}
            onChange={e => setStartTime(e.target.value)}
            disabled={!canEdit}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-400"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-700">End time</label>
          <input
            type="time"
            value={endTime}
            onChange={e => setEndTime(e.target.value)}
            disabled={!canEdit}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-400"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-700">Break (minutes)</label>
          <input
            type="number"
            min="0"
            max="480"
            value={breakMins}
            onChange={e => setBreakMins(e.target.value)}
            disabled={!canEdit}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-400"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-700">Duration</label>
          <div className="flex h-10 items-center rounded-md border border-gray-200 bg-gray-50 px-3 text-sm text-gray-600">
            {startTime && endTime
              ? formatShiftDuration(startTime, endTime, Number(breakMins) || 0)
              : '—'}
          </div>
        </div>
      </div>

      {/* Break compliance */}
      {compliance && (
        <div
          className={cn(
            'mt-3 flex items-center gap-2 rounded-md px-3 py-2 text-xs font-medium',
            compliance.compliant
              ? 'bg-green-50 text-green-700'
              : compliance.requiredBreakMinutes === 0
                ? 'bg-gray-50 text-gray-500'
                : 'bg-amber-50 text-amber-700',
          )}
        >
          {compliance.compliant || compliance.requiredBreakMinutes === 0 ? (
            <CheckCircle2 size={14} />
          ) : (
            <AlertCircle size={14} />
          )}
          {complianceBadge(compliance)}
        </div>
      )}

      <div className="mt-4">
        <label className="mb-1 block text-xs font-medium text-gray-700">Notes (optional)</label>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          disabled={!canEdit}
          rows={2}
          className="w-full resize-none rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-400"
          placeholder="Add any notes about this shift…"
        />
      </div>

      {/* Action buttons */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {canEdit && (
          <button
            onClick={() => onSave(payload)}
            disabled={saving || !startTime || !endTime}
            className="flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Saving…' : initial ? 'Save changes' : 'Save draft'}
          </button>
        )}
        {canSubmit && onSubmit && (
          <button
            onClick={() => onSubmit(initial!.id)}
            disabled={saving}
            className="flex items-center gap-1.5 rounded-md bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
          >
            <Send size={14} />
            Submit for approval
          </button>
        )}
        {canDelete && onDelete && (
          <button
            onClick={() => onDelete(initial!.id)}
            disabled={saving}
            className="flex items-center gap-1.5 rounded-md border border-red-200 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
          >
            <XCircle size={14} />
            Delete
          </button>
        )}
        <button
          onClick={onCancel}
          className="ml-auto rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          {canEdit ? 'Cancel' : 'Close'}
        </button>
      </div>
    </div>
  )
}

// ── Day card (collapsed view) ──────────────────────────────────────────────────

interface DayCardProps {
  date: Date
  timesheet: TimesheetWithLocation | null
  onOpen: () => void
}

function DayCard({ date, timesheet, onOpen }: DayCardProps) {
  const isoDate = toISODate(date)
  const today = isToday(isoDate)
  const isWeekend = [0, 6].includes(date.getDay())

  return (
    <button
      onClick={onOpen}
      className={cn(
        'flex w-full flex-col rounded-lg border p-3 text-left transition-colors hover:border-blue-300 hover:bg-blue-50',
        today ? 'border-blue-400 bg-blue-50' : 'border-gray-200 bg-white',
        isWeekend && !timesheet && 'opacity-60',
      )}
    >
      <div className="flex items-center justify-between">
        <span className={cn('text-xs font-medium', today ? 'text-blue-700' : 'text-gray-500')}>
          {date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
        </span>
        {timesheet && (
          <span
            className={cn(
              'rounded-full px-2 py-0.5 text-xs font-medium',
              TIMESHEET_STATUS_COLOURS[timesheet.status],
            )}
          >
            {TIMESHEET_STATUS_LABELS[timesheet.status]}
          </span>
        )}
      </div>

      {timesheet ? (
        <div className="mt-1 flex items-center gap-1 text-sm text-gray-700">
          <Clock size={13} className="text-gray-400" />
          {formatTime(timesheet.start_time)} – {formatTime(timesheet.end_time)}
          <span className="ml-1 text-gray-400">
            ({formatShiftDuration(timesheet.start_time, timesheet.end_time, timesheet.break_duration_minutes)})
          </span>
        </div>
      ) : (
        <div className="mt-1 flex items-center gap-1 text-xs text-gray-400">
          <Plus size={12} />
          Add shift
        </div>
      )}

      {/* Rejection reason callout */}
      {timesheet?.status === 'rejected' && timesheet.rejection_reason && (
        <div className="mt-1.5 rounded bg-red-50 px-2 py-1 text-xs text-red-600">
          Rejected: {timesheet.rejection_reason}
        </div>
      )}
    </button>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function MyTimesheets() {
  const { profile } = useAuth()
  const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()))
  const [editingDate, setEditingDate] = useState<string | null>(null)

  const days = getWeekDays(weekStart)
  const { data: timesheets = [], isLoading } = useMyWeekTimesheets(weekStart)
  const { data: defaultRule } = useDefaultBreakRule()
  const rule: BreakRule = defaultRule
    ? { trigger_hours: Number(defaultRule.trigger_hours), break_duration_minutes: defaultRule.break_duration_minutes }
    : UK_DEFAULT_RULE

  const createTs = useCreateTimesheet()
  const updateTs = useUpdateTimesheet()
  const submitTs = useSubmitTimesheet()
  const deleteTs = useDeleteTimesheet()

  const saving = createTs.isPending || updateTs.isPending || submitTs.isPending || deleteTs.isPending

  const tsMap = Object.fromEntries(timesheets.map(ts => [ts.shift_date, ts]))

  const prevWeek = () => {
    const d = new Date(weekStart)
    d.setDate(d.getDate() - 7)
    setWeekStart(d)
    setEditingDate(null)
  }
  const nextWeek = () => {
    const d = new Date(weekStart)
    d.setDate(d.getDate() + 7)
    setWeekStart(d)
    setEditingDate(null)
  }

  if (!profile) return null

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">My Timesheets</h1>
          <p className="text-sm text-gray-500">Log and submit your daily shifts</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={prevWeek}
            className="rounded-md border border-gray-300 p-1.5 hover:bg-gray-50"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="min-w-32 text-center text-sm font-medium text-gray-700">
            {formatWeekRange(weekStart)}
          </span>
          <button
            onClick={nextWeek}
            className="rounded-md border border-gray-300 p-1.5 hover:bg-gray-50"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-lg bg-gray-100" />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {days.map(day => {
            const isoDate = toISODate(day)
            const ts = tsMap[isoDate] ?? null

            if (editingDate === isoDate) {
              return (
                <TimesheetForm
                  key={isoDate}
                  date={isoDate}
                  initial={ts}
                  rule={rule}
                  saving={saving}
                  onSave={async payload => {
                    if (ts) {
                      await updateTs.mutateAsync({ id: ts.id, ...payload })
                    } else {
                      await createTs.mutateAsync(payload)
                    }
                    setEditingDate(null)
                  }}
                  onSubmit={
                    ts?.status === 'draft'
                      ? async id => {
                          await submitTs.mutateAsync(id)
                          setEditingDate(null)
                        }
                      : undefined
                  }
                  onDelete={
                    ts && (ts.status === 'draft' || ts.status === 'rejected')
                      ? async id => {
                          await deleteTs.mutateAsync(id)
                          setEditingDate(null)
                        }
                      : undefined
                  }
                  onCancel={() => setEditingDate(null)}
                />
              )
            }

            return (
              <DayCard
                key={isoDate}
                date={day}
                timesheet={ts}
                onOpen={() => setEditingDate(isoDate)}
              />
            )
          })}
        </div>
      )}

      {/* Week summary */}
      {timesheets.length > 0 && (
        <div className="mt-6 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
          <p className="text-xs font-medium text-gray-500">Week summary</p>
          <div className="mt-2 flex gap-6">
            <div>
              <span className="text-sm font-semibold text-gray-900">{timesheets.length}</span>
              <span className="ml-1 text-xs text-gray-500">shifts</span>
            </div>
            <div>
              <span className="text-sm font-semibold text-gray-900">
                {timesheets.filter(t => t.status === 'approved').length}
              </span>
              <span className="ml-1 text-xs text-gray-500">approved</span>
            </div>
            <div>
              <span className="text-sm font-semibold text-gray-900">
                {timesheets.filter(t => t.status === 'submitted').length}
              </span>
              <span className="ml-1 text-xs text-gray-500">pending</span>
            </div>
            <div>
              <span className="text-sm font-semibold text-gray-900">
                {timesheets.filter(t => !t.break_compliant && t.status !== 'draft').length}
              </span>
              <span className="ml-1 text-xs text-gray-500">break issues</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
