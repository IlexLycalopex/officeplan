import { supabase } from './supabase'

export async function signInWithMagicLink(email: string) {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      // import.meta.env.BASE_URL is '/' in dev, '/locustworks/' on GitHub Pages.
      // This ensures the callback URL is always correct regardless of deployment base path.
      emailRedirectTo: `${window.location.origin}${import.meta.env.BASE_URL}auth/callback`,
    },
  })
  return { error }
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  return { error }
}

export async function getSession() {
  const { data, error } = await supabase.auth.getSession()
  return { session: data.session, error }
}

export async function getUser() {
  const { data, error } = await supabase.auth.getUser()
  return { user: data.user, error }
}

/** Subscribe to auth state changes. Returns an unsubscribe function. */
export function onAuthStateChange(
  callback: Parameters<typeof supabase.auth.onAuthStateChange>[0],
) {
  const { data } = supabase.auth.onAuthStateChange(callback)
  return () => data.subscription.unsubscribe()
}
