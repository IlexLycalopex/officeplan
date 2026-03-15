import { useNavigate } from 'react-router-dom'
import { CalendarDays, Users, Clock, CheckSquare, Building2, DoorOpen, ClipboardList, CalendarRange, AlertCircle } from 'lucide-react'
import { addDays, format } from 'date-fns'
import { useAuth } from '@/stores/authStore'
import { useMyBookings } from '@/hooks/useBookings'
import { useMyAttendance } from '@/hooks/useRota'
import { usePendingApprovals } from '@/hooks/useApprovals'
import { useMyWeekTimesheets, TIMESHEET_STATUS_COLOURS, TIMESHEET_STATUS_LABELS } from '@/hooks/useTimesheets'
import { useMyRotaShifts } from '@/hooks/useRotaShifts'
import { formatDate, getWeekDates, isoDateString } from '@/lib/utils'
import { getWeekStart, formatTime, formatMinutes, timeDiffMinutes } from '@/lib/dateUtils'

export default function Home() {
  const { profile, isAdmin } = useAuth()
  const navigate = useNavigate()
  const weekDates = getWeekDates(0)
  const today = isoDateString(new Date())
  const weekEnd = isoDateString(weekDates[6])
  const thirtyDaysOut = isoDateString(addDays(new Date(), 30))

  // Existing data
  const { data: weekBookings } = useMyBookings(today, weekEnd)
  const { data: upcomingBookings } = useMyBookings(today, thirtyDaysOut)
  const { data: attendance } = useMyAttendance(weekDates)
  const { data: pendingApprovals } = usePendingApprovals()

  // New: timesheets + rota shifts this week
  const weekStartDate = getWeekStart(new Date())
  const { data: weekTimesheets = [] } = useMyWeekTimesheets(weekStartDate)
  const { data: rotaShifts = [] } = useMyRotaShifts(weekStartDate)

  const todayBookings = (upcomingBookings ?? []).filter(b => b.booking_date === today)
  const pendingCount = pendingApprovals?.length ?? 0

  // Timesheet summary for this week
  const approvedSheets = weekTimesheets.filter(t => t.status === 'approved')
  const pendingSheets = weekTimesheets.filter(t => t.status === 'submitted')
  const draftSheets = weekTimesheets.filter(t => t.status === 'draft')
  const totalApprovedMins = approvedSheets.reduce(
    (sum, t) => sum + Math.max(0, timeDiffMinutes(t.start_time, t.end_time) - t.break_duration_minutes),
    0,
  )

  // Today's and next upcoming rota shift
  const todayShift = rotaShifts.find(s => s.shift_date === today)
  const nextShift = rotaShifts.find(s => s.shift_date > today)
  const unacknowledgedCount = rotaShifts.filter(
    s => s.status === 'confirmed' && s.rota_shift_acknowledgements.length === 0,
  ).length

  return (
    <div className="max-w-5xl space-y-6">
      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">
          Good {getGreeting()}, {profile?.first_name ?? 'there'}
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          {format(new Date(), 'EEEE, d MMMM yyyy')}
        </p>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <QuickAction
          icon={<CalendarDays size={20} />}
          label="Book a desk"
          onClick={() => navigate('/book')}
          color="blue"
        />
        <QuickAction
          icon={<DoorOpen size={20} />}
          label="Book a room"
          onClick={() => navigate('/rooms')}
          color="indigo"
        />
        <QuickAction
          icon={<Clock size={20} />}
          label="My rota"
          onClick={() => navigate('/rota')}
          color="purple"
          badge={unacknowledgedCount > 0 ? unacknowledgedCount : undefined}
        />
        <QuickAction
          icon={<ClipboardList size={20} />}
          label="Timesheets"
          onClick={() => navigate('/timesheets')}
          color="emerald"
          badge={draftSheets.length > 0 ? draftSheets.length : undefined}
        />
        <QuickAction
          icon={<Users size={20} />}
          label="See who's in"
          onClick={() => navigate('/team')}
          color="green"
        />
        {isAdmin && pendingCount > 0 && (
          <QuickAction
            icon={<CheckSquare size={20} />}
            label={`Approvals (${pendingCount})`}
            onClick={() => navigate('/admin/approvals')}
            color="amber"
            badge={pendingCount}
          />
        )}
      </div>

      {/* Status cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* Today's bookings */}
        <StatusCard title="Today" icon={<Building2 size={16} />}>
          {todayBookings.length > 0 ? (
            <div className="space-y-2">
              {todayBookings.map(b => {
                const asset = b.workspace_assets as { name?: string; code?: string; asset_type?: string; floors?: { offices?: { name?: string } } }
                return (
                  <div key={b.id}>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-gray-900">
                        {asset?.name ?? asset?.code}
                      </p>
                      <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500 capitalize">
                        {asset?.asset_type === 'room' ? 'Room' : 'Desk'}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500">
                      {(asset?.floors as { offices?: { name?: string } } | undefined)?.offices?.name}
                    </p>
                    <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                      b.status === 'confirmed'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-amber-100 text-amber-700'
                    }`}>
                      {b.status === 'confirmed' ? 'Confirmed' : 'Pending approval'}
                    </span>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="text-sm text-gray-500">
              <p>No bookings for today.</p>
              <button
                onClick={() => navigate('/book')}
                className="mt-2 text-blue-600 hover:underline"
              >
                Book a desk →
              </button>
            </div>
          )}
        </StatusCard>

        {/* This week */}
        <StatusCard title="This week" icon={<CalendarDays size={16} />}>
          <div className="space-y-1">
            {weekDates.slice(0, 5).map(date => {
              const dateStr = isoDateString(date)
              const dayBookings = (weekBookings ?? []).filter(b => b.booking_date === dateStr)
              const plan = attendance?.find(a => a.work_date === dateStr)
              return (
                <div key={dateStr} className="flex items-center justify-between text-sm">
                  <span className="text-gray-500 w-10">{format(date, 'EEE')}</span>
                  <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                    dayBookings.length > 0 ? 'bg-blue-100 text-blue-700'
                    : plan?.plan_status === 'remote' ? 'bg-purple-100 text-purple-700'
                    : plan?.plan_status === 'leave' ? 'bg-gray-100 text-gray-600'
                    : 'text-gray-400'
                  }`}>
                    {dayBookings.length > 0
                      ? `In office${dayBookings.length > 1 ? ` (${dayBookings.length})` : ''}`
                      : plan?.plan_status === 'remote' ? 'Remote'
                      : plan?.plan_status === 'leave' ? 'Leave'
                      : '—'}
                  </span>
                </div>
              )
            })}
          </div>
        </StatusCard>

        {/* Upcoming bookings */}
        <StatusCard title="Upcoming bookings" icon={<Clock size={16} />}>
          {upcomingBookings && upcomingBookings.length > 0 ? (
            <div className="space-y-2">
              {upcomingBookings.slice(0, 5).map(b => {
                const asset = b.workspace_assets as { code?: string; name?: string; asset_type?: string }
                return (
                  <div key={b.id} className="text-sm flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-gray-900">{formatDate(b.booking_date)}</p>
                      <p className="text-gray-500">{asset?.name ?? asset?.code}</p>
                    </div>
                    <span className="shrink-0 rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500">
                      {asset?.asset_type === 'room' ? 'Room' : 'Desk'}
                    </span>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-sm text-gray-500">No upcoming bookings.</p>
          )}
        </StatusCard>

        {/* This week's timesheets */}
        <StatusCard title="Timesheets this week" icon={<ClipboardList size={16} />}>
          {weekTimesheets.length === 0 ? (
            <div className="text-sm text-gray-500">
              <p>No timesheets logged yet.</p>
              <button
                onClick={() => navigate('/timesheets')}
                className="mt-2 text-emerald-600 hover:underline"
              >
                Log your shifts →
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {/* Hours approved */}
              {totalApprovedMins > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Approved hours</span>
                  <span className="font-semibold text-gray-900">{formatMinutes(totalApprovedMins)}</span>
                </div>
              )}
              {/* Status breakdown */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {weekTimesheets.map(t => (
                  <span
                    key={t.id}
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${TIMESHEET_STATUS_COLOURS[t.status]}`}
                    title={format(new Date(t.shift_date + 'T00:00:00'), 'EEE d MMM')}
                  >
                    {format(new Date(t.shift_date + 'T00:00:00'), 'EEE')} · {TIMESHEET_STATUS_LABELS[t.status]}
                  </span>
                ))}
              </div>
              {pendingSheets.length > 0 && (
                <p className="text-xs text-amber-600">{pendingSheets.length} awaiting approval</p>
              )}
              <button
                onClick={() => navigate('/timesheets')}
                className="mt-1 text-xs text-emerald-600 hover:underline"
              >
                View all →
              </button>
            </div>
          )}
        </StatusCard>

        {/* This week's shifts from rota */}
        <StatusCard title="Scheduled shifts" icon={<CalendarRange size={16} />}>
          {rotaShifts.length === 0 ? (
            <p className="text-sm text-gray-500">No shifts scheduled this week.</p>
          ) : (
            <div className="space-y-2">
              {unacknowledgedCount > 0 && (
                <div className="flex items-center gap-1.5 rounded-lg bg-amber-50 px-2 py-1.5 text-xs text-amber-700">
                  <AlertCircle size={12} />
                  {unacknowledgedCount} shift{unacknowledgedCount !== 1 ? 's' : ''} need acknowledging
                </div>
              )}
              {/* Show today's shift prominently, then next one */}
              {todayShift ? (
                <div className="rounded-lg bg-emerald-50 px-3 py-2">
                  <p className="text-xs font-semibold text-emerald-700 mb-0.5">Today</p>
                  <p className="text-sm font-medium text-gray-900">
                    {formatTime(todayShift.start_time)} – {formatTime(todayShift.end_time)}
                  </p>
                  {todayShift.offices && (
                    <p className="text-xs text-gray-500">{todayShift.offices.name}</p>
                  )}
                </div>
              ) : nextShift ? (
                <div className="rounded-lg bg-gray-50 px-3 py-2">
                  <p className="text-xs font-semibold text-gray-500 mb-0.5">
                    {format(new Date(nextShift.shift_date + 'T00:00:00'), 'EEEE d MMM')}
                  </p>
                  <p className="text-sm font-medium text-gray-900">
                    {formatTime(nextShift.start_time)} – {formatTime(nextShift.end_time)}
                  </p>
                  {nextShift.offices && (
                    <p className="text-xs text-gray-500">{nextShift.offices.name}</p>
                  )}
                </div>
              ) : null}
              <p className="text-xs text-gray-400">
                {rotaShifts.length} shift{rotaShifts.length !== 1 ? 's' : ''} this week
              </p>
              <button
                onClick={() => navigate('/rota')}
                className="text-xs text-emerald-600 hover:underline"
              >
                View rota →
              </button>
            </div>
          )}
        </StatusCard>
      </div>
    </div>
  )
}

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'morning'
  if (h < 17) return 'afternoon'
  return 'evening'
}

function QuickAction({
  icon, label, onClick, color, badge,
}: {
  icon: React.ReactNode
  label: string
  onClick: () => void
  color: 'blue' | 'indigo' | 'purple' | 'green' | 'amber' | 'emerald'
  badge?: number
}) {
  const colours = {
    blue: 'bg-blue-50 text-blue-700 hover:bg-blue-100',
    indigo: 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100',
    purple: 'bg-purple-50 text-purple-700 hover:bg-purple-100',
    green: 'bg-green-50 text-green-700 hover:bg-green-100',
    amber: 'bg-amber-50 text-amber-700 hover:bg-amber-100',
    emerald: 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100',
  }
  return (
    <button
      onClick={onClick}
      className={`relative flex flex-col items-center gap-2 rounded-xl p-4 text-sm font-medium transition-colors ${colours[color]}`}
    >
      {badge && (
        <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs text-white">
          {badge}
        </span>
      )}
      {icon}
      {label}
    </button>
  )
}

function StatusCard({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-medium text-gray-700">
        {icon}
        {title}
      </div>
      {children}
    </div>
  )
}
