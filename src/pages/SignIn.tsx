import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { MapPin } from 'lucide-react'
import { signInWithMagicLink } from '@/lib/auth'
import { useAuth } from '@/stores/authStore'

export default function SignIn() {
  const { user } = useAuth()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (user) return <Navigate to="/home" replace />

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { error } = await signInWithMagicLink(email)
    if (error) {
      setError(error.message)
    } else {
      setSent(true)
    }
    setLoading(false)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
        <div className="mb-6 flex flex-col items-center gap-2">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-600">
            <MapPin className="text-white" size={24} />
          </div>
          <h1 className="text-xl font-semibold text-gray-900">Locustworks</h1>
          <p className="text-center text-sm text-gray-500">
            Desk, rota, timesheets and room management
          </p>
        </div>

        {sent ? (
          <div className="rounded-lg bg-green-50 p-4 text-center text-sm text-green-800">
            <p className="font-medium">Check your email</p>
            <p className="mt-1 text-green-700">
              We sent a sign-in link to <strong>{email}</strong>
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Work email address
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@company.com"
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {error && (
              <p className="text-sm text-red-600">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:opacity-50"
            >
              {loading ? 'Sending…' : 'Send sign-in link'}
            </button>
          </form>
        )}

        <p className="mt-4 text-center text-xs text-gray-400">
          You'll receive a secure link by email — no password needed.
        </p>
      </div>
    </div>
  )
}
