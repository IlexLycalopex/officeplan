import { useState } from 'react'
import { Users, MonitorPlay, PenLine, Phone } from 'lucide-react'
import { useOffices, useFloorAssets } from '@/hooks/useFloor'
import { useFloorBookings, useCreateBooking } from '@/hooks/useBookings'
import { useAuth } from '@/stores/authStore'
import { isoDateString } from '@/lib/utils'
import { format } from 'date-fns'
import type { Tables } from '@/types/database'

type Asset = Tables<'workspace_assets'>

// Day timeline: 09:00–18:00 in 30-min slots
const TIMELINE_START = 9
const TIMELINE_END   = 18
const SLOT_MINS      = 30
const TOTAL_SLOTS    = ((TIMELINE_END - TIMELINE_START) * 60) / SLOT_MINS // 18

const DURATIONS: { label: string; minutes: number }[] = [
  { label: '30 min',  minutes: 30 },
  { label: '1 hr',    minutes: 60 },
  { label: '1.5 hr',  minutes: 90 },
  { label: '2 hr',    minutes: 120 },
  { label: '3 hr',    minutes: 180 },
  { label: 'All day', minutes: (TIMELINE_END - TIMELINE_START) * 60 },
]

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

function minutesToTime(m: number): string {
  const h = Math.floor(m / 60)
  const min = m % 60
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`
}

function bookedSlotIndices(
  roomId: string,
  bookings: { asset_id: string; start_time: string | null; end_time: string | null; status: string }[],
): Set<number> {
  const booked = new Set<number>()
  bookings
    .filter(b => b.asset_id === roomId && ['confirmed', 'pending_approval'].includes(b.status))
    .forEach(b => {
      const startMins = b.start_time ? timeToMinutes(b.start_time) : TIMELINE_START * 60
      const endMins   = b.end_time   ? timeToMinutes(b.end_time)   : TIMELINE_END * 60
      for (let slot = 0; slot < TOTAL_SLOTS; slot++) {
        const slotStart = TIMELINE_START * 60 + slot * SLOT_MINS
        const slotEnd   = slotStart + SLOT_MINS
        if (slotStart < endMins && slotEnd > startMins) booked.add(slot)
      }
    })
  return booked
}

function firstFreeSlot(bookedSlots: Set<number>, durationMins: number): string {
  const slotsNeeded = durationMins / SLOT_MINS
  for (let slot = 0; slot <= TOTAL_SLOTS - slotsNeeded; slot++) {
    let free = true
    for (let i = 0; i < slotsNeeded; i++) {
      if (bookedSlots.has(slot + i)) { free = false; break }
    }
    if (free) return minutesToTime(TIMELINE_START * 60 + slot * SLOT_MINS)
  }
  return minutesToTime(TIMELINE_START * 60)
}

export default function Rooms() {
  const { profile } = useAuth()
  const { data: offices } = useOffices()
  const [selectedOfficeId, setSelectedOfficeId] = useState<string | null>(null)
  const [selectedFloorId, setSelectedFloorId] = useState<string | null>(null)
  const [selectedDate, setSelectedDate] = useState(isoDateString(new Date()))
  const [booking, setBooking] = useState<{ room: Asset; startTime: string; durationMins: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const { data: allAssets } = useFloorAssets(selectedFloorId)
  const { data: bookings } = useFloorBookings(selectedFloorId, selectedDate)
  const createBooking = useCreateBooking()

  const rooms = allAssets?.filter(a => a.asset_type === 'room') ?? []
  const selectedOffice = offices?.find(o => o.id === selectedOfficeId)

  function openBookingModal(room: Asset) {
    const bookedSlots = bookedSlotIndices(room.id, bookings ?? [])
    const defaultDuration = 60
    const startTime = firstFreeSlot(bookedSlots, defaultDuration)
    setBooking({ room, startTime, durationMins: defaultDuration })
    setError(null)
  }

  async function handleBookRoom() {
    if (!booking || !profile) return
    setError(null)
    const endTime = minutesToTime(timeToMinutes(booking.startTime) + booking.durationMins)
    try {
      await createBooking.mutateAsync({
        assetId: booking.room.id,
        userId: profile.id,
        date: selectedDate,
        startTime: booking.startTime,
        endTime,
      })
      setSuccess(
        `${booking.room.name} booked for ${format(new Date(selectedDate + 'T00:00:00'), 'd MMM')} · ${booking.startTime}–${endTime}`,
      )
      setBooking(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Booking failed')
    }
  }

  return (
    <div className="max-w-4xl space-y-4">
      <h1 className="text-xl font-semibold text-gray-900">Meeting Rooms</h1>

      {success && (
        <div className="rounded-lg bg-green-50 px-4 py-2 text-sm text-green-800">{success}</div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select
          value={selectedOfficeId ?? ''}
          onChange={e => { setSelectedOfficeId(e.target.value || null); setSelectedFloorId(null) }}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        >
          <option value="">Select office…</option>
          {offices?.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>

        {selectedOffice && (
          <select
            value={selectedFloorId ?? ''}
            onChange={e => setSelectedFloorId(e.target.value || null)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          >
            <option value="">All floors</option>
            {(selectedOffice.floors as { id: string; name: string }[])?.map(f => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </select>
        )}

        <input
          type="date"
          value={selectedDate}
          min={isoDateString(new Date())}
          onChange={e => setSelectedDate(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        />
      </div>

      {/* Room cards */}
      {rooms.length === 0 ? (
        <div className="flex h-40 items-center justify-center text-sm text-gray-400">
          {selectedFloorId ? 'No meeting rooms on this floor.' : 'Select an office and floor to view rooms.'}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rooms.map(room => {
            const bookedSlots = bookedSlotIndices(room.id, bookings ?? [])
            const isFullyBooked = bookedSlots.size === TOTAL_SLOTS
            return (
              <div key={room.id} className="rounded-xl border border-gray-200 bg-white p-4">
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-gray-900">{room.name ?? room.code}</p>
                    <p className="text-xs text-gray-500">{room.code}</p>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    isFullyBooked ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                  }`}>
                    {isFullyBooked ? 'Fully booked' : 'Available'}
                  </span>
                </div>

                {/* Features */}
                <div className="mt-3 flex flex-wrap gap-2 text-xs text-gray-600">
                  {room.capacity && (
                    <span className="flex items-center gap-1"><Users size={12} />{room.capacity} seats</span>
                  )}
                  {room.features.includes('video_conf') && (
                    <span className="flex items-center gap-1"><MonitorPlay size={12} />Video conf</span>
                  )}
                  {room.features.includes('whiteboard') && (
                    <span className="flex items-center gap-1"><PenLine size={12} />Whiteboard</span>
                  )}
                  {room.features.includes('phone') && (
                    <span className="flex items-center gap-1"><Phone size={12} />Phone</span>
                  )}
                </div>

                {/* Availability timeline */}
                <div className="mt-3">
                  <p className="mb-1 text-[10px] text-gray-400 uppercase tracking-wide">
                    Availability · {TIMELINE_START}:00–{TIMELINE_END}:00
                  </p>
                  <div className="flex h-4 gap-px overflow-hidden rounded">
                    {Array.from({ length: TOTAL_SLOTS }).map((_, i) => (
                      <div
                        key={i}
                        title={`${minutesToTime(TIMELINE_START * 60 + i * SLOT_MINS)}–${minutesToTime(TIMELINE_START * 60 + (i + 1) * SLOT_MINS)}`}
                        className={`flex-1 ${bookedSlots.has(i) ? 'bg-red-400' : 'bg-green-300'}`}
                      />
                    ))}
                  </div>
                  <div className="mt-0.5 flex justify-between text-[10px] text-gray-400">
                    <span>{TIMELINE_START}:00</span>
                    <span>{(TIMELINE_START + TIMELINE_END) >> 1}:00</span>
                    <span>{TIMELINE_END}:00</span>
                  </div>
                </div>

                {!isFullyBooked && (
                  <button
                    onClick={() => openBookingModal(room)}
                    className="mt-3 w-full rounded-lg bg-blue-600 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
                  >
                    Book
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Booking modal */}
      {booking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-96 rounded-xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-gray-900">Book {booking.room.name}</h2>
            <p className="mt-1 text-sm text-gray-500">
              {format(new Date(selectedDate + 'T00:00:00'), 'EEEE, d MMMM yyyy')}
            </p>

            <div className="mt-4 space-y-4">
              <label className="block">
                <span className="text-xs text-gray-600">Start time</span>
                <input
                  type="time"
                  value={booking.startTime}
                  onChange={e => setBooking(b => b ? { ...b, startTime: e.target.value } : b)}
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
                />
              </label>

              <div>
                <span className="text-xs text-gray-600">Duration</span>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {DURATIONS.map(d => (
                    <button
                      key={d.minutes}
                      type="button"
                      onClick={() => setBooking(b => b ? { ...b, durationMins: d.minutes } : b)}
                      className={`rounded-lg border px-3 py-1 text-xs font-medium transition-colors ${
                        booking.durationMins === d.minutes
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
                <p className="mt-1 text-xs text-gray-400">
                  Ends at {minutesToTime(timeToMinutes(booking.startTime) + booking.durationMins)}
                </p>
              </div>
            </div>

            {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

            <div className="mt-4 flex gap-2">
              <button
                onClick={handleBookRoom}
                disabled={createBooking.isPending}
                className="flex-1 rounded-lg bg-blue-600 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {createBooking.isPending ? 'Booking…' : 'Confirm'}
              </button>
              <button
                onClick={() => { setBooking(null); setError(null) }}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
