import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { format } from 'date-fns'
import { useNavigate } from 'react-router-dom'
import { useMyAttendance, useUpsertAttendance } from '@/hooks/useRota'
import { useMyBookings } from '@/hooks/useBookings'
import { getWeekDates, isoDateString } from '@/lib/utils'
import type { Enums } from '@/types/database'

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

export default function Rota() {
  const [weekOffset, setWeekOffset] = useState(0)
  const navigate = useNavigate()
  const weekDates = getWeekDates(weekOffset)
  const { data: attendance } = useMyAttendance(weekDates)
  const upsert = useUpsertAttendance()

  // Load bookings for the visible week to check if desks are already booked
  const weekStart = isoDateString(weekDates[0])
  const weekEnd = isoDateString(weekDates[4])
  const { data: myBookings } = useMyBookings(weekStart, weekEnd)

  // Prompt state: { dateStr } — show after switching to in_office with no desk booked
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

    // After switching to in_office, check if a desk is already booked that day
    if (next.value === 'in_office') {
      const ds = isoDateString(date)
      const hasDesk = (myBookings ?? []).some(
        b =>
          b.booking_date === ds &&
          ['confirmed', 'pending_approval'].includes(b.status) &&
          (b.workspace_assets as { asset_type?: string } | null)?.asset_type === 'desk',
      )
      if (!hasDesk) {
        setBookPromptDate(ds)
      }
    } else {
      // Dismiss prompt if user changes status away from in_office
      setBookPromptDate(null)
    }
  }

  return (
    <div className="max-w-3xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">My Rota</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setWeekOffset(o => o - 1)}
            disabled={weekOffset <= 0}
            className="rounded-lg border border-gray-300 p-1.5 text-gray-500 hover:bg-gray-50 disabled:opacity-30"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="min-w-36 text-center text-sm text-gray-600">
            {format(weekDates[0], 'd MMM')} – {format(weekDates[4], 'd MMM yyyy')}
          </span>
          <button
            onClick={() => setWeekOffset(o => o + 1)}
            className="rounded-lg border border-gray-300 p-1.5 text-gray-500 hover:bg-gray-50"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <p className="text-sm text-gray-500">
        Click a day to cycle through statuses. Selecting <strong>In Office</strong> will prompt you to book a desk.
      </p>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="grid grid-cols-5 divide-x divide-gray-200">
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
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
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
      <div className="flex flex-wrap gap-3">
        {STATUS_OPTIONS.filter(o => o.value !== 'unplanned').map(opt => (
          <div key={opt.value} className="flex items-center gap-1.5 text-xs text-gray-600">
            <span className={`inline-block rounded px-1.5 py-0.5 border text-xs ${opt.colour}`}>
              {opt.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
