import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/stores/authStore'

export function AdminRoute() {
  const { isAdmin, loading } = useAuth()

  if (loading) return null

  if (!isAdmin) {
    return <Navigate to="/home" replace />
  }

  return <Outlet />
}
