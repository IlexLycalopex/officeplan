import { useState } from 'react'
import { format, addDays } from 'date-fns'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { FloorMap } from '@/components/floor-map/FloorMap'
import { useOffices, useFloorAssets, useFloor } from '@/hooks/useFloor'
import { useFloorBookings, useCreateBooking } from '@/hooks/useBookings'
import { useAuth } from '@/stores/authStore'
import { isoDateString, daysUntil } from '@/lib/utils'
import type { Tables } from '@/types/database'

type Asset = Tables<'workspace_assets'>

export default function BookDesk() {
  const { profile } = useAuth()
  const { data: offices } = useOffices()

  const [selectedOfficeId, setSelectedOfficeId] = useState<string | null>(null)
  const [selectedFloorId, setSelectedFloorId] = useState<string | null>(null)
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null)
  const [notes, setNotes] = useState('')
  const [success, setSuccess] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const dateStr = isoDateString(selectedDate)
  const { data: assets } = useFloorAssets(selectedFloorId)
  const { data: floor } = useFloor(selectedFloorId)
  const { data: bookings } = useFloorBookings(selectedFloorId, dateStr)
  const createBooking = useCreateBooking()

  const daysAhead = daysUntil(dateStr)
  const isAdvanceBooking = daysAhead > 14

  // Build booking overlay for the map
  const bookingOverlay = (bookings ?? []).map(b => ({
    assetId: b.asset_id,
    status: b.status as 'confirmed' | 'pending_approval',
    userName: (b.users as { first_name?: string; last_name?: string } | null)
      ? `${(b.users as { first_name: string }).first_name} ${(b.users as { last_name: string }).last_name}`
      : undefined,
  }))

  const selectedOffice = offices?.find(o => o.id === selectedOfficeId)

  async function handleConfirm() {
    if (!selectedAsset || !profile) return
    setError(null)
    try {
      const result = await createBooking.mutateAsync({
        assetId: selectedAsset.id,
        userId: profile.id,
        date: dateStr,
        notes: notes || undefined,
      })
      const r = result as { booking_id?: string; status?: string }
      setSuccess(
        r.status === 'pending_approval'
          ? 'Booking request submitted — awaiting approval.'
          : 'Desk booked successfully!',
      )
      setSelectedAsset(null)
      setNotes('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Booking failed')
    }
  }

  return (
    <div className="max-w-6xl space-y-4">
      <h1 className="text-xl font-semibold text-gray-900">Book a Desk</h1>

      {success && (
        <div className="flex items-center justify-between rounded-lg bg-green-50 px-4 py-3 text-sm text-green-800">
          {success}
          <button onClick={() => setSuccess(null)}><X size={16} /></button>
        </div>
      )}

      {/* Selectors */}
      <div className="flex flex-wrap gap-3">
        {/* Office */}
        <select
          value={selectedOfficeId ?? ''}
          onChange={e => {
            setSelectedOfficeId(e.target.value || null)
            setSelectedFloorId(null)
            setSelectedAsset(null)
          }}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        >
          <option value="">Select office…</option>
          {offices?.map(o => (
            <option key={o.id} value={o.id}>{o.name}</option>
          ))}
        </select>

        {/* Floor */}
        {selectedOffice && (
          <select
            value={selectedFloorId ?? ''}
            onChange={e => { setSelectedFloorId(e.target.value || null); setSelectedAsset(null) }}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          >
            <option value="">Select floor…</option>
            {(selectedOffice.floors as { id: string; name: string; sequence: number }[])
              ?.sort((a, b) => a.sequence - b.sequence)
              .map(f => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
          </select>
        )}

        {/* Date picker */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => { setSelectedDate(d => addDays(d, -1)); setSelectedAsset(null) }}
            disabled={isoDateString(addDays(selectedDate, -1)) < isoDateString(new Date())}
            className="rounded p-1.5 text-gray-500 hover:bg-gray-100 disabled:opacity-30"
          >
            <ChevronLeft size={16} />
          </button>
          <input
            type="date"
            value={dateStr}
            min={isoDateString(new Date())}
            onChange={e => { setSelectedDate(new Date(e.target.value + 'T00:00:00')); setSelectedAsset(null) }}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />
          <button
            onClick={() => { setSelectedDate(d => addDays(d, 1)); setSelectedAsset(null) }}
            className="rounded p-1.5 text-gray-500 hover:bg-gray-100"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Advance booking notice */}
      {isAdvanceBooking && (
        <div className="rounded-lg bg-amber-50 px-4 py-2 text-sm text-amber-800">
          This date is more than 14 days ahead — booking will require approval before confirmation.
        </div>
      )}

      <div className="flex gap-4">
        {/* Map */}
        <div className="flex-1">
          {floor && assets ? (
            <FloorMap
              floor={floor}
              assets={assets}
              bookings={bookingOverlay}
              selectedAssetId={selectedAsset?.id}
              onAssetClick={asset => { setSelectedAsset(asset); setError(null) }}
            />
          ) : (
            <div className="flex h-64 items-center justify-center rounded-xl border-2 border-dashed border-gray-200 text-sm text-gray-400">
              {selectedFloorId ? 'Loading floor plan…' : 'Select an office and floor to view the layout'}
            </div>
          )}
        </div>

        {/* Booking panel */}
        {selectedAsset && (
          <div className="w-72 shrink-0 rounded-xl border border-gray-200 bg-white p-4">
            <h3 className="font-semibold text-gray-900">
              {selectedAsset.name ?? selectedAsset.code}
            </h3>
            <p className="text-sm text-gray-500">{selectedAsset.code}</p>

            {selectedAsset.features.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {selectedAsset.features.map(f => (
                  <span key={f} className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                    {f.replace(/_/g, ' ')}
                  </span>
                ))}
              </div>
            )}

            <p className="mt-3 text-sm font-medium text-gray-700">
              {format(selectedDate, 'EEEE, d MMMM yyyy')}
            </p>

            {isAdvanceBooking && (
              <p className="mt-1 text-xs text-amber-600">Will be submitted for approval</p>
            )}

            <label className="mt-3 block">
              <span className="text-xs font-medium text-gray-600">Notes (optional)</span>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={2}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
                placeholder="Any notes for this booking…"
              />
            </label>

            {error && <p className="mt-2 text-xs text-red-600">{error}</p>}

            <div className="mt-4 flex gap-2">
              <button
                onClick={handleConfirm}
                disabled={createBooking.isPending}
                className="flex-1 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {createBooking.isPending ? 'Booking…' : isAdvanceBooking ? 'Request booking' : 'Confirm booking'}
              </button>
              <button
                onClick={() => setSelectedAsset(null)}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
