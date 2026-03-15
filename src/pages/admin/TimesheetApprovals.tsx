import { useState } from 'react'
import { CheckCircle2, XCircle, Clock, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/stores/authStore'
import {
  usePendingTimesheets,
  useApproveTimesheet,
  useRejectTimesheet,
  useTimesheetAmendments,
  TIMESHEET_STATUS_COLOURS,
  TIMESHEET_STATUS_LABELS,
  type TimesheetWithStaff,
} from '@/hooks/useTimesheets'
import { useDefaultBreakRule } from '@/hooks/useBreakRules'
import {
  formatDate,
  formatTime,
  formatShiftDuration,
} from '@/lib/dateUtils'
import {
  calculateBreakCompliance,
  complianceBadge,
  UK_DEFAULT_RULE,
  type BreakRule,
} from '@/lib/breakCompliance'

// ── Reject modal ───────────────────────────────────────────────────────────────

interface RejectModalProps {
  timesheetId: string
  staffName: string
  onConfirm: (reason: string) => void
  onClose: () => void
  loading: boolean
}

function RejectModal({ timesheetId: _timesheetId, staffName, onConfirm, onClose, loading }: RejectModalProps) {
  const [reason, setReason] = useState('')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <h3 className="mb-1 text-base font-semibold text-gray-900">Reject timesheet</h3>
        <p className="mb-4 text-sm text-gray-500">
          Rejecting {staffName}'s submission. Please provide a reason so they can correct it.
        </p>
        <textarea
          value={reason}
          onChange={e => setReason(e.target.value)}
          rows={3}
          className="w-full resize-none rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          placeholder="e.g. Start time doesn't match attendance records…"
          autoFocus
        />
        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(reason.trim())}
            disabled={!reason.trim() || loading}
            className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            {loading ? 'Rejecting…' : 'Reject'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Timesheet approval card ────────────────────────────────────────────────────

interface ApprovalCardProps {
  ts: TimesheetWithStaff
  rule: BreakRule
  currentUserId: string
  onApprove: (id: string) => void
  onReject: (ts: TimesheetWithStaff) => void
  approving: boolean
}

function ApprovalCard({ ts, rule, currentUserId: _currentUserId, onApprove, onReject, approving }: ApprovalCardProps) {
  const [expanded, setExpanded] = useState(false)
  const { data: amendments = [] } = useTimesheetAmendments(expanded ? ts.id : null)

  const staff = ts.users
  const staffName = staff ? `${staff.first_name} ${staff.last_name}` : 'Unknown'

  const compliance = calculateBreakCompliance(
    ts.start_time,
    ts.end_time,
    ts.break_duration_minutes,
    rule,
  )

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="px-5 py-4">
        {/* Header row */}
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-gray-900">{staffName}</span>
              {staff?.job_title && (
                <span className="text-sm text-gray-400">· {staff.job_title}</span>
              )}
            </div>
            <p className="text-sm text-gray-500">{formatDate(ts.shift_date)}</p>
          </div>
          <span
            className={cn(
              'shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium',
              TIMESHEET_STATUS_COLOURS[ts.status],
            )}
          >
            {TIMESHEET_STATUS_LABELS[ts.status]}
          </span>
        </div>

        {/* Shift details */}
        <div className="mt-3 grid grid-cols-3 gap-3">
          <div className="rounded-md bg-gray-50 px-3 py-2">
            <p className="text-xs text-gray-400">Start</p>
            <p className="text-sm font-medium text-gray-900">{formatTime(ts.start_time)}</p>
          </div>
          <div className="rounded-md bg-gray-50 px-3 py-2">
            <p className="text-xs text-gray-400">End</p>
            <p className="text-sm font-medium text-gray-900">{formatTime(ts.end_time)}</p>
          </div>
          <div className="rounded-md bg-gray-50 px-3 py-2">
            <p className="text-xs text-gray-400">Duration</p>
            <p className="text-sm font-medium text-gray-900">
              {formatShiftDuration(ts.start_time, ts.end_time, ts.break_duration_minutes)}
            </p>
          </div>
        </div>

        {/* Break compliance */}
        <div
          className={cn(
            'mt-3 flex items-center gap-1.5 rounded-md px-3 py-2 text-xs font-medium',
            compliance.compliant || compliance.requiredBreakMinutes === 0
              ? 'bg-green-50 text-green-700'
              : 'bg-amber-50 text-amber-700',
          )}
        >
          {compliance.compliant || compliance.requiredBreakMinutes === 0 ? (
            <CheckCircle2 size={13} />
          ) : (
            <AlertCircle size={13} />
          )}
          Break: {ts.break_duration_minutes}m taken · {complianceBadge(compliance)}
        </div>

        {ts.notes && (
          <p className="mt-3 rounded-md bg-blue-50 px-3 py-2 text-xs text-blue-700">
            Note: {ts.notes}
          </p>
        )}

        {ts.location_id && ts.offices && (
          <p className="mt-2 text-xs text-gray-500">Location: {ts.offices.name}</p>
        )}

        {/* Submitted at */}
        {ts.submitted_at && (
          <p className="mt-2 flex items-center gap-1 text-xs text-gray-400">
            <Clock size={11} />
            Submitted {new Date(ts.submitted_at).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })}
          </p>
        )}

        {/* Action buttons */}
        {ts.status === 'submitted' && (
          <div className="mt-4 flex gap-2">
            <button
              onClick={() => onApprove(ts.id)}
              disabled={approving}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-md bg-green-600 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
            >
              <CheckCircle2 size={15} />
              Approve
            </button>
            <button
              onClick={() => onReject(ts)}
              disabled={approving}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-red-200 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
            >
              <XCircle size={15} />
              Reject
            </button>
          </div>
        )}

        {/* Expand amendments */}
        <button
          onClick={() => setExpanded(e => !e)}
          className="mt-3 flex w-full items-center justify-center gap-1 text-xs text-gray-400 hover:text-gray-600"
        >
          {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          {expanded ? 'Hide' : 'Show'} amendment history
        </button>
      </div>

      {/* Amendment history */}
      {expanded && (
        <div className="border-t border-gray-100 bg-gray-50 px-5 py-4">
          {amendments.length === 0 ? (
            <p className="text-xs text-gray-400">No amendments recorded.</p>
          ) : (
            <ul className="space-y-2">
              {amendments.map(a => (
                <li key={a.id} className="text-xs text-gray-600">
                  <span className="font-medium capitalize">{a.amendment_type.replace('_', ' ')}</span>
                  {' · '}
                  {new Date(a.created_at).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })}
                  {a.reason && <span className="ml-1 text-gray-400">— {a.reason}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function TimesheetApprovals() {
  const { profile } = useAuth()
  const { data: pending = [], isLoading } = usePendingTimesheets()
  const { data: defaultRule } = useDefaultBreakRule()
  const rule: BreakRule = defaultRule
    ? { trigger_hours: Number(defaultRule.trigger_hours), break_duration_minutes: defaultRule.break_duration_minutes }
    : UK_DEFAULT_RULE

  const approveTs = useApproveTimesheet()
  const rejectTs = useRejectTimesheet()

  const [rejectTarget, setRejectTarget] = useState<TimesheetWithStaff | null>(null)

  if (!profile) return null

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Timesheet Approvals</h1>
        <p className="text-sm text-gray-500">
          Review and approve submitted timesheets from your team
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-40 animate-pulse rounded-lg bg-gray-100" />
          ))}
        </div>
      ) : pending.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white py-16 text-center">
          <CheckCircle2 className="mx-auto mb-3 text-green-400" size={40} />
          <p className="font-medium text-gray-700">All caught up!</p>
          <p className="mt-1 text-sm text-gray-400">No timesheets are waiting for approval.</p>
        </div>
      ) : (
        <>
          <p className="mb-4 text-sm text-gray-500">
            {pending.length} timesheet{pending.length !== 1 ? 's' : ''} awaiting approval
          </p>
          <div className="space-y-4">
            {pending.map(ts => (
              <ApprovalCard
                key={ts.id}
                ts={ts}
                rule={rule}
                currentUserId={profile.id}
                onApprove={id =>
                  approveTs.mutate({ id, approvedBy: profile.id })
                }
                onReject={t => setRejectTarget(t)}
                approving={approveTs.isPending}
              />
            ))}
          </div>
        </>
      )}

      {/* Reject modal */}
      {rejectTarget && (
        <RejectModal
          timesheetId={rejectTarget.id}
          staffName={
            rejectTarget.users
              ? `${rejectTarget.users.first_name} ${rejectTarget.users.last_name}`
              : 'Unknown'
          }
          loading={rejectTs.isPending}
          onConfirm={reason => {
            rejectTs.mutate(
              { id: rejectTarget.id, rejectedBy: profile.id, reason },
              { onSuccess: () => setRejectTarget(null) },
            )
          }}
          onClose={() => setRejectTarget(null)}
        />
      )}
    </div>
  )
}
