import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from '@/stores/authStore'
import { ProtectedRoute } from '@/components/layout/ProtectedRoute'
import { AdminRoute } from '@/components/layout/AdminRoute'
import { AppShell } from '@/components/layout/AppShell'
import SignIn from '@/pages/SignIn'
import AuthCallback from '@/pages/AuthCallback'
import Home from '@/pages/Home'
import BookDesk from '@/pages/BookDesk'
import Rota from '@/pages/Rota'
import Rooms from '@/pages/Rooms'
import TeamView from '@/pages/TeamView'
import Reports from '@/pages/Reports'
import Profile from '@/pages/Profile'
import AdminUsers from '@/pages/admin/Users'
import AdminOffices from '@/pages/admin/Offices'
import AdminFloorEditor from '@/pages/admin/FloorEditor'
import AdminPolicies from '@/pages/admin/Policies'
import AdminSchedules from '@/pages/admin/Schedules'
import AdminApprovals from '@/pages/admin/Approvals'

export default function App() {
  return (
    <BrowserRouter basename={import.meta.env.VITE_BASE_PATH ?? '/'}>
      <AuthProvider>
        <Routes>
          {/* Public */}
          <Route path="/sign-in" element={<SignIn />} />
          <Route path="/auth/callback" element={<AuthCallback />} />

          {/* Protected — all inside the app shell */}
          <Route element={<ProtectedRoute />}>
            <Route element={<AppShell />}>
              <Route index element={<Navigate to="/home" replace />} />
              <Route path="/home" element={<Home />} />
              <Route path="/book" element={<BookDesk />} />
              <Route path="/rota" element={<Rota />} />
              <Route path="/rooms" element={<Rooms />} />
              <Route path="/team" element={<TeamView />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/profile" element={<Profile />} />

              {/* Admin only */}
              <Route element={<AdminRoute />}>
                <Route path="/admin/users" element={<AdminUsers />} />
                <Route path="/admin/offices" element={<AdminOffices />} />
                <Route path="/admin/floor-editor" element={<AdminFloorEditor />} />
                <Route path="/admin/policies" element={<AdminPolicies />} />
                <Route path="/admin/schedules" element={<AdminSchedules />} />
                <Route path="/admin/approvals" element={<AdminApprovals />} />
              </Route>
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/home" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
