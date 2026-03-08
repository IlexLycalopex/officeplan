import { useState, useEffect, type FormEvent } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/stores/authStore'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTeams } from '@/hooks/useOrganisation'
import type { Tables } from '@/types/database'

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export default function Profile() {
  const { profile, user } = useAuth()
  const qc = useQueryClient()
  const { data: teams } = useTeams()

  const [firstName, setFirstName] = useState(profile?.first_name ?? '')
  const [lastName, setLastName] = useState(profile?.last_name ?? '')
  const [jobTitle, setJobTitle] = useState(profile?.job_title ?? '')
  const [teamId, setTeamId] = useState<string>('')
  const [workingDays, setWorkingDays] = useState<number[]>(profile?.normal_working_days ?? [1,2,3,4,5])
  const [officeDays, setOfficeDays] = useState<number[]>(profile?.normal_office_days ?? [1,3])
  const [saved, setSaved] = useState(false)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any

  useEffect(() => {
    if (profile) {
      setFirstName(profile.first_name)
      setLastName(profile.last_name)
      setJobTitle(profile.job_title ?? '')
      setWorkingDays(profile.normal_working_days)
      setOfficeDays(profile.normal_office_days)
      // team_id may not be in the cached profile type — fetch separately
      sb.from('users')
        .select('team_id')
        .eq('id', profile.id)
        .single()
        .then(({ data }: { data: { team_id: string | null } | null }) => {
          if (data?.team_id) setTeamId(data.team_id)
        })
    }
  }, [profile]) // eslint-disable-line react-hooks/exhaustive-deps

  // Notification preferences
  const { data: prefs } = useQuery({
    queryKey: ['notif-prefs'],
    enabled: !!profile,
    queryFn: async (): Promise<Tables<'notification_preferences'> | null> => {
      const { data, error } = await sb
        .from('notification_preferences')
        .select('*')
        .eq('user_id', profile!.id)
        .single()
      if (error) throw error
      return data as unknown as Tables<'notification_preferences'>
    },
  })

  const [weeklyDigest, setWeeklyDigest] = useState(true)
  const [dailyDigest, setDailyDigest] = useState(false)
  useEffect(() => {
    if (prefs) {
      setWeeklyDigest(prefs.weekly_digest)
      setDailyDigest(prefs.daily_digest)
    }
  }, [prefs])

  const updateProfile = useMutation({
    mutationFn: async () => {
      if (!profile) return
      const { error } = await sb
        .from('users')
        .update({
          first_name: firstName,
          last_name: lastName,
          job_title: jobTitle,
          normal_working_days: workingDays,
          normal_office_days: officeDays,
          team_id: teamId || null,
        })
        .eq('id', profile.id)
      if (error) throw error

      await sb
        .from('notification_preferences')
        .upsert({ user_id: profile.id, weekly_digest: weeklyDigest, daily_digest: dailyDigest })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notif-prefs'] })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    },
  })

  function toggleDay(day: number, setter: (fn: (prev: number[]) => number[]) => void) {
    setter(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day].sort()
    )
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    updateProfile.mutate()
  }

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-xl font-semibold text-gray-900">My Profile</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Personal info */}
        <section className="rounded-xl border border-gray-200 bg-white p-6">
          <h2 className="mb-4 text-sm font-semibold text-gray-700">Personal Information</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs font-medium text-gray-600">First name</span>
              <input
                value={firstName}
                onChange={e => setFirstName(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-gray-600">Last name</span>
              <input
                value={lastName}
                onChange={e => setLastName(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
            </label>
            <label className="block sm:col-span-2">
              <span className="text-xs font-medium text-gray-600">Job title</span>
              <input
                value={jobTitle}
                onChange={e => setJobTitle(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
            </label>
            <div className="sm:col-span-2">
              <span className="text-xs font-medium text-gray-600">Email</span>
              <p className="mt-1 text-sm text-gray-500">{user?.email}</p>
            </div>
            <label className="block sm:col-span-2">
              <span className="text-xs font-medium text-gray-600">Team</span>
              <select
                value={teamId}
                onChange={e => setTeamId(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              >
                <option value="">No team</option>
                {(teams ?? []).map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </label>
          </div>
        </section>

        {/* Working pattern */}
        <section className="rounded-xl border border-gray-200 bg-white p-6">
          <h2 className="mb-4 text-sm font-semibold text-gray-700">Working Pattern</h2>
          <div className="space-y-4">
            <div>
              <p className="text-xs font-medium text-gray-600 mb-2">Normal working days</p>
              <div className="flex gap-2">
                {DAYS.map((d, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => toggleDay(i, setWorkingDays)}
                    className={`h-9 w-10 rounded-lg text-xs font-medium transition-colors ${
                      workingDays.includes(i)
                        ? 'bg-blue-600 text-white'
                        : 'border border-gray-300 text-gray-500 hover:bg-gray-50'
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-600 mb-2">Normal in-office days</p>
              <div className="flex gap-2">
                {DAYS.map((d, i) => (
                  <button
                    key={i}
                    type="button"
                    disabled={!workingDays.includes(i)}
                    onClick={() => toggleDay(i, setOfficeDays)}
                    className={`h-9 w-10 rounded-lg text-xs font-medium transition-colors disabled:opacity-30 ${
                      officeDays.includes(i)
                        ? 'bg-green-600 text-white'
                        : 'border border-gray-300 text-gray-500 hover:bg-gray-50'
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Notification preferences */}
        <section className="rounded-xl border border-gray-200 bg-white p-6">
          <h2 className="mb-4 text-sm font-semibold text-gray-700">Notification Preferences</h2>
          <div className="space-y-3">
            <Toggle
              label="Weekly digest"
              description="Monday morning summary of your week ahead"
              checked={weeklyDigest}
              onChange={setWeeklyDigest}
            />
            <Toggle
              label="Daily digest"
              description="Morning reminder about today's bookings"
              checked={dailyDigest}
              onChange={setDailyDigest}
            />
            <div className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-500">
              Approval outcome notifications are always sent and cannot be disabled.
            </div>
          </div>
        </section>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={updateProfile.isPending}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {updateProfile.isPending ? 'Saving…' : 'Save changes'}
          </button>
          {saved && <span className="text-sm text-green-600">Saved!</span>}
          {updateProfile.isError && (
            <span className="text-sm text-red-600">Save failed — try again.</span>
          )}
        </div>
      </form>
    </div>
  )
}

function Toggle({
  label, description, checked, onChange,
}: { label: string; description: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <div className="relative mt-0.5 shrink-0">
        <input
          type="checkbox"
          checked={checked}
          onChange={e => onChange(e.target.checked)}
          className="sr-only"
        />
        <div className={`h-5 w-9 rounded-full transition-colors ${checked ? 'bg-blue-600' : 'bg-gray-300'}`} />
        <div className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-4' : 'translate-x-0.5'}`} />
      </div>
      <div>
        <p className="text-sm font-medium text-gray-900">{label}</p>
        <p className="text-xs text-gray-500">{description}</p>
      </div>
    </label>
  )
}
