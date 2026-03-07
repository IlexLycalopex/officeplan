import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'

export default function AuthCallback() {
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // getSession() internally awaits Supabase's full initialization, which
    // includes processing any #access_token= hash from the magic link URL.
    // We do NOT react to SIGNED_OUT here — that event can fire if an old
    // localStorage session fails to refresh, and would race with the new
    // hash tokens still being processed.
    supabase.auth.getSession().then(({ data, error }) => {
      if (error || !data.session) {
        // Also listen for SIGNED_IN in case _initialize fires it after getSession resolves.
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
          if (session) {
            subscription.unsubscribe()
            navigate('/home', { replace: true })
          } else if (event === 'INITIAL_SESSION') {
            // Confirmed: no session arrived. Show error.
            subscription.unsubscribe()
            setError('Sign-in link has expired or has already been used. Please request a new one.')
          }
        })
        // Safety timeout — if nothing fires within 5 s, show error.
        setTimeout(() => {
          subscription.unsubscribe()
          setError(prev => prev ?? 'Sign-in timed out. Please request a new link.')
        }, 5000)
        return
      }
      navigate('/home', { replace: true })
    })
  }, [navigate])

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm">
          <p className="text-sm text-red-600">{error}</p>
          <button
            onClick={() => navigate('/sign-in', { replace: true })}
            className="mt-4 text-sm text-blue-600 hover:underline"
          >
            Back to sign in
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
    </div>
  )
}
