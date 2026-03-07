import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'

export default function AuthCallback() {
  const navigate = useNavigate()

  useEffect(() => {
    // Magic link / PKCE code exchange is async. Listen for auth state change
    // rather than calling getSession() immediately (which races the exchange).
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (session) {
          navigate('/home', { replace: true })
        } else if (event === 'SIGNED_OUT') {
          navigate('/sign-in', { replace: true })
        }
      }
    )

    // Also check immediately — session may already be set if the client
    // finished processing the URL before the component mounted.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        navigate('/home', { replace: true })
      }
    })

    return () => subscription.unsubscribe()
  }, [navigate])

  return (
    <div className="flex h-screen items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
    </div>
  )
}
