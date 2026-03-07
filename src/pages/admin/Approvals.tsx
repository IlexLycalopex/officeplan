import { useState } from 'react'
import { CheckCircle, XCircle } from 'lucide-react'
import { usePendingApprovals, useDecideApproval } from '@/hooks/useApprovals'
import { formatDate } from '@/lib/utils'

export default function AdminApprovals() {
  const { data: requests, isLoading } = usePendingApprovals()
  const decide = useDecideApproval()
  const [notes, setNotes] = useState<Record<string, string>>({})

  async function handleDecide(requestId: string, decision: 'approved' | 'rejected') {
    await decide.mutateAsync({ requestId, decision, notes: notes[requestId] })
    setNotes(n => { const c = { ...n }; delete c[requestId]; return c })
  }

  return (
    <div className="max-w-4xl space-y-4">
      <h1 className="text-xl font-semibold text-gray-900">Pending Approvals</h1>

      {isLoading && <p className="text-sm text-gray-500">Loading…</p>}

      {!isLoading && (!requests || requests.length === 0) && (
        <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-gray-200 text-sm text-gray-400">
          No pending approval requests.
        </div>
      )}

      <div className="space-y-3">
        {requests?.map(req => {
          const requester = req.requester as { first_name?: string; last_name?: string; email?: string; job_title?: string } | null
          const booking = req.bookings as {
            booking_date?: string
            notes?: string
            workspace_assets?: { code?: string; name?: string; asset_type?: string; floors?: { name?: string; offices?: { name?: string } } }
          } | null

          return (
            <div key={req.id} className="rounded-xl border border-gray-200 bg-white p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-semibold text-gray-900">
                    {requester?.first_name} {requester?.last_name}
                    <span className="ml-2 text-sm font-normal text-gray-500">({requester?.job_title})</span>
                  </p>
                  <p className="text-sm text-gray-500">{requester?.email}</p>

                  <div className="mt-2 text-sm text-gray-700">
                    <span className="font-medium">Desk:</span>{' '}
                    {booking?.workspace_assets?.name ?? booking?.workspace_assets?.code}
                    {' — '}
                    {booking?.workspace_assets?.floors?.offices?.name} / {booking?.workspace_assets?.floors?.name}
                  </div>

                  <div className="text-sm text-gray-700">
                    <span className="font-medium">Date:</span>{' '}
                    {booking?.booking_date ? formatDate(booking.booking_date) : '—'}
                  </div>

                  {booking?.notes && (
                    <div className="text-sm text-gray-500">
                      <span className="font-medium">Notes:</span> {booking.notes}
                    </div>
                  )}

                  <div className="mt-1 text-xs text-gray-400 capitalize">
                    Type: {req.request_type.replace('_', ' ')}
                  </div>
                </div>

                <span className="shrink-0 rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-700">
                  Pending
                </span>
              </div>

              <div className="mt-4 flex items-center gap-3">
                <input
                  type="text"
                  placeholder="Decision notes (optional)…"
                  value={notes[req.id] ?? ''}
                  onChange={e => setNotes(n => ({ ...n, [req.id]: e.target.value }))}
                  className="flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
                />
                <button
                  onClick={() => handleDecide(req.id, 'approved')}
                  disabled={decide.isPending}
                  className="flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                >
                  <CheckCircle size={14} /> Approve
                </button>
                <button
                  onClick={() => handleDecide(req.id, 'rejected')}
                  disabled={decide.isPending}
                  className="flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                >
                  <XCircle size={14} /> Reject
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
