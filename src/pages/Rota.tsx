import { useState } from 'react'
import { ChevronLeft, ChevronRight, CheckCircle2, Clock, MapPin, AlertCircle } from 'lucide-react'
import { format } from 'date-fns'
import { useNavigate } from 'react-router-dom'
import { useMyAttendance, useUpsertAttendance } from '@/hooks/useRota'
import { useMyBookings } from '@/hooks/useBookings'
import { getWeekDates, isoDateString } from '@/lib/utils'
import { getWeekStart, formatWeekRange, formatTime, formatMinutes, timeDiffMinutes } from '@/lib/dateUtils'
import {
  useMyRotaShifts,
  useAcknowledgeShift,
  ROTA_STATUS_COLOURS,
  ROTA_STATUS_LABELS,
  type RotaShiftWithDetails,
} from '@/hooks/useRotaShifts'
import type { Enums } from '@/types/database'
import { cn } from '@/lib/utils'

type PlanStatus = Enums<'plan_status'>

const STATUS_OPTIONS: { value: PlanStatus; label: string; colour: string }[] = [
  { value: 'in_office', label: 'In Office', colour: 'bg-blue-100 text-blue-700 border-blue-300' },
  { value: 'remote', label: 'Remote', colour: 'bg-purple-100 text-purple-700 border-purple-300' },
  { value: 'leave', label: 'Leave', colour: 'bg-gray-100 text-gray-600 border-gray-300' },
  { value: 'unavailable', label: 'Unavailable', colour: 'bg-red-100 text-red-700 border-red-300' },
  { value: 'unplanned', label: '—', colour: 'bg-white text-gray-400 border-gray-200' },
]

function statusStyle(s: PlanStatus | undefined): string {
  return STATUS_OPTIONS.find(o => o.value === s)?.colour ?? STATUS_OPTIONS[4].colour
}

// ── Shift card ────────────────────────────────────────────────────────────────

interface ShiftCardProps {
  shift: RotaShiftWithDetails
}

function ShiftCard({ shift }: ShiftCardProps) {
  const acknowledge = useAcknowledgeShift()
  const isAcknowledged = shift.rota_shift_acknowledgements.length > 0
  const canAcknowledge = shift.status === 'confirmed' && !isAcknowledged
  const netMins = Math.max(0, timeDiffMinutes(shift.start_time, shift.end_time) - shift.break_mins)

  return (
    <div className={cn('rounded-xl border p-4', ROTA_STATUS_COLOURS[shift.status])}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cn('rounded-full border px-2 py-0.5 text-xs font-medium', ROTA_STATUS_COLOURS[shift.status])}>
              {ROTA_STATUS_LABELS[shift.status]}
            </span>
            <span className="text-sm font-semibold text-gray-900">
              {format(new Date(shift.shift_date + 'T00:00:00'), 'EEEE, d MMM')}
            </span>
          </div>

          <div className="mt-2 flex items-center gap-4 text-sm text-gray-700">
            <span className="flex items-center gap-1">
              <Clock size={13} className="text-gray-400" />
              {formatTime(shift.start_time)} – {formatTime(shift.end_time)}
            </span>
            <span className="text-gray-500 text-xs">{formatMinutes(netMins)} net</span>
          </div>

          {shift.offices && (
            <div className="mt-1 flex items-center gap-1 text-xs text-gray-500">
              <MapPin size={11} />
              {shift.offices.name}
            </div>
          )}

          {shift.notes && (
            <p className="mt-2 text-xs text-gray-600 italic">{shift.notes}</p>
          )}
        </div>

        {/* Acknowledge button / badge */}
        <div className="shrink-0">
          {isAcknowledged ? (
            <div className="flex items-center gap-1 text-xs text-emerald-600 font-medium">
              <CheckCircle2 size={14} />
              Acknowledged
            </div>
          ) : canAcknowledge ? (
            <button
              onClick={() => acknowledge.mutate({ shiftId: shift.id, shiftStatus: shift.status })}
              disabled={acknowledge.isPending}
              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {acknowledge.isPending ? 'Saving…' : 'Acknowledge'}
            </button>
          ) : shift.status === 'tentative' ? (
            <div className="flex items-center gap-1 text-xs text-yellow-600">
              <AlertCircle size={13} />
              Awaiting confirmation
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function Rota() {
  const [weekOffset, setWeekOffset] = useState(0)
  const navigate = useNavigate()
  const weekDates = getWeekDates(weekOffset)
  const { data: attendance } = useMyAttendance(weekDates)
  const upsert = useUpsertAttendance()

  // Week start (Monday) as Date, for rota shifts hook
  const weekStartDate = getWeekStart(weekDates[0])

  // Load rota shifts for the visible week
  const { data: rotaShifts = [] } = useMyRotaShifts(weekStartDate)

  // Load bookings for the visible week to check if desks are already booked
  const weekStart = isoDateString(weekDates[0])
  const weekEnd = isoDateString(weekDates[4])
  const { data: myBookings } = useMyBookings(weekStart, weekEnd)

  const [bookPromptDate, setBookPromptDate] = useState<string | null>(null)
  const workDays = weekDates.slice(0, 5) // Mon–Fri

  function getStatus(date: Date): PlanStatus {
    const ds = isoDateString(date)
    return (attendance?.find(a => a.work_date === ds)?.plan_status as PlanStatus) ?? 'unplanned'
  }

  async function cycleStatus(date: Date) {
    const current = getStatus(date)
    const idx = STATUS_OPTIONS.findIndex(o => o.value === current)
    const next = STATUS_OPTIONS[(idx + 1) % STATUS_OPTIONS.length]
    await upsert.mutateAsync({ workDate: isoDateString(date), status: next.value })

    if (next.value === 'in_office') {
      const ds = isoDateString(date)
      const hasDesk = (myBookings ?? []).some(
        b =>
          b.booking_date === ds &&
          ['confirmed', 'pending_approval'].includes(b.status) &&
          (b.workspace_assets as { asset_type?: string } | null)?.asset_type === 'desk',
      )
      if (!hasDesk) setBookPromptDate(ds)
    } else {
      setBookPromptDate(null)
    }
  }

  // Unacknowledged confirmed shifts this week (for banner)
  const unacknowledged = rotaShifts.filter(
    s => s.status === 'confirmed' && s.rota_shift_acknowledgements.length === 0,
  )

  return (
    <div className="max-w-3xl space-y-6">
      {/* ── Assigned shifts section ─── */}
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <h1 className="text-xl font-semibold text-gray-900">My Rota</h1>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setWeekOffset(o => o - 1)}
              disabled={weekOffset <= -4}
              className="rounded-lg border border-gray-300 p-1.5 text-gray-500 hover:bg-gray-50 disabled:opacity-30"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="min-w-40 text-center text-sm text-gray-600">
              {formatWeekRange(weekStartDate)}
            </span>
            <button
              onClick={() => setWeekOffset(o => o + 1)}
              className="rounded-lg border border-gray-300 p-1.5 text-gray-500 hover:bg-gray-50"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        {/* Acknowledgement nudge */}
        {unacknowledged.length > 0 && (
          <div className="mb-3 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            <AlertCircle size={15} className="shrink-0" />
            You have {unacknowledged.length} shift{unacknowledged.length !== 1 ? 's' : ''} that need{unacknowledged.length === 1 ? 's' : ''} acknowledging.
          </div>
        )}

        {/* Shift cards */}
        {rotaShifts.length > 0 ? (
          <div className="space-y-2">
            {rotaShifts.map(shift => (
              <ShiftCard key={shift.id} shift={shift} />
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 py-6 text-center text-sm text-gray-400">
            No shifts scheduled this week.
          </div>
        )}
      </div>

      {/* ── Attendance planner section ─── */}
      <div>
        <h2 className="mb-2 text-base font-semibold text-gray-900">Attendance Plan</h2>
        <p className="mb-3 text-sm text-gray-500">
          Click a day to cycle through statuses. Selecting <strong>In Office</strong> will prompt you to book a desk.
        </p>

        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <div className="grid min-w-[380px] grid-cols-5 divide-x divide-gray-200">
            {workDays.map(date => {
              const status = getStatus(date)
              const opt = STATUS_OPTIONS.find(o => o.value === status)!
              const isPast = isoDateString(date) < isoDateString(new Date())
              return (
                <div key={date.toISOString()} className="p-3">
                  <p className="text-xs font-medium text-gray-500">{format(date, 'EEE')}</p>
                  <p className="text-sm font-semibold text-gray-900">{format(date, 'd MMM')}</p>
                  <button
                    disabled={isPast || upsert.isPending}
                    onClick={() => cycleStatus(date)}
                    className={`mt-3 w-full rounded-lg border px-2 py-2 text-xs font-medium transition-colors ${statusStyle(status)} ${
                      isPast ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:opacity-80'
                    }`}
                  >
                    {opt.label}
                  </button>
                </div>
              )
            })}
          </div>
        </div>

        {/* Desk booking prompt */}
        {bookPromptDate && (
          <div className="mt-3 rounded-xl border border-blue-200 bg-blue-50 p-4">
            <p className="text-sm font-medium text-blue-900">
              You haven't booked a desk for{' '}
              <strong>{format(new Date(bookPromptDate + 'T00:00:00'), 'EEEE, d MMM')}</strong>.
            </p>
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => navigate(`/book?date=${bookPromptDate}`)}
                className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
              >
                Book a desk →
              </button>
              <button
                onClick={() => setBookPromptDate(null)}
                className="rounded-lg border border-blue-300 px-3 py-1.5 text-sm text-blue-700 hover:bg-blue-100"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* Legend */}
        <div className="mt-3 flex flex-wrap gap-3">
          {STATUS_OPTIONS.filter(o => o.value !== 'unplanned').map(opt => (
            <div key={opt.value} className="flex items-center gap-1.5 text-xs text-gray-600">
              <span className={`inline-block rounded px-1.5 py-0.5 border text-xs ${opt.colour}`}>
                {opt.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
