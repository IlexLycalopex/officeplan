import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { type User, type Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { Tables } from '@/types/database'

type UserProfile = Tables<'users'>

interface AuthState {
  user: User | null
  session: Session | null
  profile: UserProfile | null
  loading: boolean
}

interface AuthContextValue extends AuthState {
  isAdmin: boolean
  isManager: boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    profile: null,
    loading: true,
  })

  useEffect(() => {
    // Initial session
    supabase.auth.getSession().then(({ data }) => {
      setState(prev => ({
        ...prev,
        session: data.session,
        user: data.session?.user ?? null,
      }))
      if (data.session?.user) {
        fetchProfile(data.session.user.id)
      } else {
        setState(prev => ({ ...prev, loading: false }))
      }
    })

    // Auth state changes
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setState(prev => ({ ...prev, session, user: session?.user ?? null }))
      if (session?.user) {
        fetchProfile(session.user.id)
      } else {
        // Do NOT set loading:false here. INITIAL_SESSION fires before
        // initializePromise resolves (i.e. before URL hash tokens are
        // processed). Setting loading:false prematurely causes ProtectedRoute
        // to redirect to /sign-in before SIGNED_IN arrives with the real session.
        // loading:false is set exclusively by getSession().then() (line ~41)
        // and fetchProfile() (line ~64), both of which run after full init.
        setState(prev => ({ ...prev, profile: null }))
      }
    })

    return () => data.subscription.unsubscribe()
  }, [])

  async function fetchProfile(authUserId: string) {
    const { data } = await supabase
      .from('users')
      .select('*')
      .eq('auth_user_id', authUserId)
      .single()
    setState(prev => ({ ...prev, profile: data, loading: false }))
  }

  const isAdmin = state.profile?.role === 'admin' || state.profile?.role === 'system_admin'
  const isManager = isAdmin || state.profile?.role === 'manager'

  return (
    <AuthContext.Provider value={{ ...state, isAdmin, isManager }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
