import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  CalendarDays,
  RotateCcw,
  DoorOpen,
  Users,
  BarChart3,
  User,
  Settings,
  ChevronDown,
  Building2,
  FlipHorizontal,
  ShieldCheck,
  Bell,
  UserCog,
  MapPin,
  Landmark,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/stores/authStore'
import { useState } from 'react'

interface NavItem {
  label: string
  to: string
  icon: React.ReactNode
}

const navItems: NavItem[] = [
  { label: 'Home', to: '/home', icon: <LayoutDashboard size={18} /> },
  { label: 'Book a Desk', to: '/book', icon: <CalendarDays size={18} /> },
  { label: 'My Rota', to: '/rota', icon: <RotateCcw size={18} /> },
  { label: 'Meeting Rooms', to: '/rooms', icon: <DoorOpen size={18} /> },
  { label: 'Team View', to: '/team', icon: <Users size={18} /> },
  { label: 'Reports', to: '/reports', icon: <BarChart3 size={18} /> },
  { label: 'My Profile', to: '/profile', icon: <User size={18} /> },
]

const adminItems: NavItem[] = [
  { label: 'Organisation', to: '/admin/organisation', icon: <Landmark size={18} /> },
  { label: 'Users', to: '/admin/users', icon: <UserCog size={18} /> },
  { label: 'Offices & Floors', to: '/admin/offices', icon: <Building2 size={18} /> },
  { label: 'Floor Editor', to: '/admin/floor-editor', icon: <FlipHorizontal size={18} /> },
  { label: 'Approvals', to: '/admin/approvals', icon: <ShieldCheck size={18} /> },
  { label: 'Policies', to: '/admin/policies', icon: <Settings size={18} /> },
  { label: 'Notifications', to: '/admin/schedules', icon: <Bell size={18} /> },
]

interface Props {
  open: boolean
}

export function Sidebar({ open }: Props) {
  const { isAdmin, profile } = useAuth()
  const [adminExpanded, setAdminExpanded] = useState(false)

  if (!open) return null

  return (
    <aside className="flex w-60 flex-col border-r border-gray-200 bg-white">
      {/* Brand */}
      <div className="flex h-16 items-center gap-2 border-b border-gray-200 px-4">
        <MapPin className="text-blue-600" size={22} />
        <span className="text-lg font-semibold text-gray-900">OfficePlan</span>
      </div>

      {/* Main nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-3">
        <ul className="space-y-0.5">
          {navItems.map(item => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
                  )
                }
              >
                {item.icon}
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>

        {/* Admin section */}
        {isAdmin && (
          <div className="mt-4">
            <button
              onClick={() => setAdminExpanded(e => !e)}
              className="flex w-full items-center justify-between rounded-md px-3 py-2 text-xs font-semibold uppercase tracking-wider text-gray-400 hover:text-gray-600"
            >
              Administration
              <ChevronDown
                size={14}
                className={cn('transition-transform', adminExpanded && 'rotate-180')}
              />
            </button>
            {adminExpanded && (
              <ul className="mt-1 space-y-0.5">
                {adminItems.map(item => (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      className={({ isActive }) =>
                        cn(
                          'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                          isActive
                            ? 'bg-blue-50 text-blue-700'
                            : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
                        )
                      }
                    >
                      {item.icon}
                      {item.label}
                    </NavLink>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </nav>

      {/* Profile footer */}
      <div className="border-t border-gray-200 p-3">
        <div className="flex items-center gap-2 rounded-md px-2 py-1.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-sm font-medium text-white">
            {profile?.first_name?.[0] ?? '?'}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-gray-900">
              {profile ? `${profile.first_name} ${profile.last_name}` : 'Loading…'}
            </p>
            <p className="truncate text-xs text-gray-500">{profile?.job_title ?? ''}</p>
          </div>
        </div>
      </div>
    </aside>
  )
}
