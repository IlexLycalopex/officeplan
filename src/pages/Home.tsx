import { useNavigate } from 'react-router-dom'
import { CalendarDays, Users, Clock, CheckSquare, Building2 } from 'lucide-react'
import { useAuth } from '@/stores/authStore'
import { useMyBookings } from '@/hooks/useBookings'
import { useMyAttendance } from '@/hooks/useRota'
import { usePendingApprovals } from '@/hooks/useApprovals'
import { formatDate, getWeekDates, isoDateString } from '@/lib/utils'
import { format } from 'date-fns'

export default function Home() {
  const { profile, isAdmin } = useAuth()
  const navigate = useNavigate()
  const weekDates = getWeekDates(0)
  const today = isoDateString(new Date())
  const weekEnd = isoDateString(weekDates[6])

  const { data: bookings } = useMyBookings(today, weekEnd)
  const { data: attendance } = useMyAttendance(weekDates)
  const { data: pendingApprovals } = usePendingApprovals()

  const todayBooking = bookings?.find(b => b.booking_date === today)
  const pendingCount = pendingApprovals?.length ?? 0

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
          icon={<Clock size={20} />}
          label="My rota"
          onClick={() => navigate('/rota')}
          color="purple"
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
        {/* Today's booking */}
        <StatusCard title="Today" icon={<Building2 size={16} />}>
          {todayBooking ? (
            <div>
              <p className="font-medium text-gray-900">
                {(todayBooking.workspace_assets as { name?: string })?.name ??
                 (todayBooking.workspace_assets as { code?: string })?.code}
              </p>
              <p className="text-sm text-gray-500">
                {((todayBooking.workspace_assets as { floors?: { offices?: { name?: string } } })?.floors?.offices?.name)}
              </p>
              <span className={`mt-2 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                todayBooking.status === 'confirmed'
                  ? 'bg-green-100 text-green-700'
                  : 'bg-amber-100 text-amber-700'
              }`}>
                {todayBooking.status === 'confirmed' ? 'Confirmed' : 'Pending approval'}
              </span>
            </div>
          ) : (
            <div className="text-sm text-gray-500">
              <p>No desk booked for today.</p>
              <button
                onClick={() => navigate('/book')}
                className="mt-2 text-blue-600 hover:underline"
              >
                Book now →
              </button>
            </div>
          )}
        </StatusCard>

        {/* This week */}
        <StatusCard title="This week" icon={<CalendarDays size={16} />}>
          <div className="space-y-1">
            {weekDates.slice(0, 5).map(date => {
              const dateStr = isoDateString(date)
              const booking = bookings?.find(b => b.booking_date === dateStr)
              const plan = attendance?.find(a => a.work_date === dateStr)
              return (
                <div key={dateStr} className="flex items-center justify-between text-sm">
                  <span className="text-gray-500 w-10">{format(date, 'EEE')}</span>
                  <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                    booking ? 'bg-blue-100 text-blue-700'
                    : plan?.plan_status === 'remote' ? 'bg-purple-100 text-purple-700'
                    : plan?.plan_status === 'leave' ? 'bg-gray-100 text-gray-600'
                    : 'text-gray-400'
                  }`}>
                    {booking ? 'In office'
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
          {bookings && bookings.length > 0 ? (
            <div className="space-y-2">
              {bookings.slice(0, 4).map(b => (
                <div key={b.id} className="text-sm">
                  <p className="font-medium text-gray-900">{formatDate(b.booking_date)}</p>
                  <p className="text-gray-500">
                    {(b.workspace_assets as { code?: string })?.code}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">No upcoming bookings.</p>
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
  color: 'blue' | 'purple' | 'green' | 'amber'
  badge?: number
}) {
  const colours = {
    blue: 'bg-blue-50 text-blue-700 hover:bg-blue-100',
    purple: 'bg-purple-50 text-purple-700 hover:bg-purple-100',
    green: 'bg-green-50 text-green-700 hover:bg-green-100',
    amber: 'bg-amber-50 text-amber-700 hover:bg-amber-100',
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
