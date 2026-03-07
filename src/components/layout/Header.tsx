import { Menu, LogOut, Bell } from 'lucide-react'
import { useAuth } from '@/stores/authStore'
import { signOut } from '@/lib/auth'
import { useNavigate } from 'react-router-dom'
import { format } from 'date-fns'

interface Props {
  onMenuClick: () => void
}

export function Header({ onMenuClick }: Props) {
  const { profile } = useAuth()
  const navigate = useNavigate()

  async function handleSignOut() {
    await signOut()
    navigate('/sign-in')
  }

  return (
    <header className="flex h-16 items-center justify-between border-b border-gray-200 bg-white px-6">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100"
          aria-label="Toggle sidebar"
        >
          <Menu size={20} />
        </button>
        <span className="text-sm text-gray-500">
          {format(new Date(), 'EEEE, d MMMM yyyy')}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <button
          className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100"
          aria-label="Notifications"
        >
          <Bell size={20} />
        </button>
        <button
          onClick={handleSignOut}
          className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100"
        >
          <LogOut size={16} />
          Sign out
        </button>
      </div>
    </header>
  )
}
