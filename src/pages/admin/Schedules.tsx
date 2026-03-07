import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { Tables } from '@/types/database'
import { supabase } from '@/lib/supabase'
import { format } from 'date-fns'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any

function useSchedules() {
  return useQuery({
    queryKey: ['admin', 'schedules'],
    queryFn: async (): Promise<Tables<'notification_schedules'>[]> => {
      const { data, error } = await sb
        .from('notification_schedules')
        .select('*')
        .order('schedule_type')
      if (error) throw error
      return (data ?? []) as unknown as Tables<'notification_schedules'>[]
    },
  })
}

const SCHEDULE_LABELS: Record<string, string> = {
  weekly_digest: 'Weekly Digest',
  daily_digest: 'Daily Digest',
  approval_alert: 'Approval Alert',
  booking_confirmation: 'Booking Confirmation',
}

export default function AdminSchedules() {
  const { data: schedules, isLoading } = useSchedules()
  const qc = useQueryClient()

  const toggle = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await sb
        .from('notification_schedules')
        .update({ active_flag: active })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'schedules'] }),
  })

  const updateCron = useMutation({
    mutationFn: async ({ id, cron }: { id: string; cron: string }) => {
      const { error } = await sb
        .from('notification_schedules')
        .update({ cron_expression: cron })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'schedules'] }),
  })

  return (
    <div className="max-w-3xl space-y-4">
      <h1 className="text-xl font-semibold text-gray-900">Notification Schedules</h1>
      <p className="text-sm text-gray-500">
        Schedules are executed by Supabase Cron. Cron expressions follow standard 5-field syntax (minute hour day-of-month month day-of-week).
      </p>

      {isLoading && <p className="text-sm text-gray-500">Loading…</p>}

      <div className="space-y-3">
        {schedules?.map(s => (
          <div key={s.id} className="rounded-xl border border-gray-200 bg-white p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-medium text-gray-900">{SCHEDULE_LABELS[s.schedule_type] ?? s.schedule_type}</p>
                {s.last_run_at && (
                  <p className="text-xs text-gray-400 mt-0.5">
                    Last run: {format(new Date(s.last_run_at), 'd MMM yyyy HH:mm')}
                    {s.last_run_status && (
                      <span className={`ml-2 ${s.last_run_status === 'ok' ? 'text-green-600' : 'text-red-500'}`}>
                        ({s.last_run_status})
                      </span>
                    )}
                  </p>
                )}
              </div>

              {/* Active toggle */}
              <label className="flex items-center gap-2 cursor-pointer shrink-0">
                <span className="text-sm text-gray-600">{s.active_flag ? 'Active' : 'Inactive'}</span>
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={s.active_flag}
                    onChange={e => toggle.mutate({ id: s.id, active: e.target.checked })}
                    className="sr-only"
                  />
                  <div className={`h-5 w-9 rounded-full transition-colors ${s.active_flag ? 'bg-blue-600' : 'bg-gray-300'}`} />
                  <div className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${s.active_flag ? 'translate-x-4' : 'translate-x-0.5'}`} />
                </div>
              </label>
            </div>

            {/* Cron expression editor */}
            <div className="mt-3 flex items-center gap-2">
              <code className="text-xs text-gray-500">cron:</code>
              <input
                defaultValue={s.cron_expression}
                onBlur={e => {
                  if (e.target.value !== s.cron_expression) {
                    updateCron.mutate({ id: s.id, cron: e.target.value })
                  }
                }}
                className="flex-1 rounded-lg border border-gray-300 px-3 py-1.5 font-mono text-sm"
              />
            </div>
            <p className="mt-1 text-xs text-gray-400">
              Example: <code>0 8 * * 1</code> = Monday 8am · <code>0 7 * * 1-5</code> = weekdays 7am
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
