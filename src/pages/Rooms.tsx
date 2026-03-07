import { useState } from 'react'
import { Users, MonitorPlay, PenLine } from 'lucide-react'
import { useOffices, useFloorAssets } from '@/hooks/useFloor'
import { useFloorBookings, useCreateBooking } from '@/hooks/useBookings'
import { useAuth } from '@/stores/authStore'
import { isoDateString } from '@/lib/utils'
import { format } from 'date-fns'
import type { Tables } from '@/types/database'

type Asset = Tables<'workspace_assets'>

export default function Rooms() {
  const { profile } = useAuth()
  const { data: offices } = useOffices()
  const [selectedOfficeId, setSelectedOfficeId] = useState<string | null>(null)
  const [selectedFloorId, setSelectedFloorId] = useState<string | null>(null)
  const [selectedDate, setSelectedDate] = useState(isoDateString(new Date()))
  const [booking, setBooking] = useState<{ room: Asset; startTime: string; endTime: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const { data: allAssets } = useFloorAssets(selectedFloorId)
  const { data: bookings } = useFloorBookings(selectedFloorId, selectedDate)
  const createBooking = useCreateBooking()

  const rooms = allAssets?.filter(a => a.asset_type === 'room') ?? []
  const selectedOffice = offices?.find(o => o.id === selectedOfficeId)

  function isRoomBooked(roomId: string): boolean {
    return (bookings ?? []).some(b => b.asset_id === roomId && b.status in ['confirmed', 'pending_approval'])
  }

  async function handleBookRoom() {
    if (!booking || !profile) return
    setError(null)
    try {
      await createBooking.mutateAsync({
        assetId: booking.room.id,
        userId: profile.id,
        date: selectedDate,
        startTime: booking.startTime,
        endTime: booking.endTime,
      })
      setSuccess(`${booking.room.name} booked for ${format(new Date(selectedDate + 'T00:00:00'), 'd MMM')}`)
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
            const booked = isRoomBooked(room.id)
            return (
              <div key={room.id} className="rounded-xl border border-gray-200 bg-white p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-gray-900">{room.name ?? room.code}</p>
                    <p className="text-xs text-gray-500">{room.code}</p>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    booked ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                  }`}>
                    {booked ? 'Booked' : 'Available'}
                  </span>
                </div>

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
                </div>

                {!booked && (
                  <button
                    onClick={() => setBooking({ room, startTime: '09:00', endTime: '10:00' })}
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

            <div className="mt-4 grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-xs text-gray-600">Start time</span>
                <input
                  type="time"
                  value={booking.startTime}
                  onChange={e => setBooking(b => b ? { ...b, startTime: e.target.value } : b)}
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
                />
              </label>
              <label className="block">
                <span className="text-xs text-gray-600">End time</span>
                <input
                  type="time"
                  value={booking.endTime}
                  onChange={e => setBooking(b => b ? { ...b, endTime: e.target.value } : b)}
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
                />
              </label>
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
