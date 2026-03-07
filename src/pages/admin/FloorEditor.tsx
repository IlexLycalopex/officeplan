import { useState, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Save, Eye } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useFloorAssetsAdmin, useOffices, useFloor } from '@/hooks/useFloor'
import { FloorMap } from '@/components/floor-map/FloorMap'
import type { Tables } from '@/types/database'

type Asset = Tables<'workspace_assets'>
type AssetType = Asset['asset_type']

const ASSET_PALETTE: { type: AssetType; label: string; defaultW: number; defaultH: number }[] = [
  { type: 'desk', label: 'Desk', defaultW: 8, defaultH: 5 },
  { type: 'room', label: 'Meeting Room', defaultW: 20, defaultH: 15 },
  { type: 'zone', label: 'Zone', defaultW: 30, defaultH: 20 },
  { type: 'amenity', label: 'Amenity', defaultW: 6, defaultH: 6 },
  { type: 'no_book', label: 'No-book area', defaultW: 15, defaultH: 10 },
]

export default function AdminFloorEditor() {
  const [searchParams] = useSearchParams()
  const floorId = searchParams.get('floorId')
  const qc = useQueryClient()

  const { data: offices } = useOffices()
  const [selectedFloorId, setSelectedFloorId] = useState<string | null>(floorId)
  const { data: floor } = useFloor(selectedFloorId)
  const { data: assets, refetch } = useFloorAssetsAdmin(selectedFloorId)

  const [selectedPalette, setSelectedPalette] = useState<typeof ASSET_PALETTE[0]>(ASSET_PALETTE[0])
  const [newCode, setNewCode] = useState('')
  const [newName, setNewName] = useState('')
  const [newX, setNewX] = useState(5)
  const [newY, setNewY] = useState(5)
  const [hasDrafts, setHasDrafts] = useState(false)
  const [success, setSuccess] = useState<string | null>(null)

  const addAsset = useMutation({
    mutationFn: async () => {
      if (!selectedFloorId || !newCode) return
      const { error } = await supabase.from('workspace_assets').insert({
        floor_id: selectedFloorId,
        asset_type: selectedPalette.type,
        code: newCode,
        name: newName || null,
        x: newX,
        y: newY,
        width: selectedPalette.defaultW,
        height: selectedPalette.defaultH,
        is_draft: true,
      })
      if (error) throw error
    },
    onSuccess: () => {
      refetch()
      setHasDrafts(true)
      setNewCode('')
      setNewName('')
    },
  })

  const publishLayout = useMutation({
    mutationFn: async () => {
      if (!selectedFloorId) return
      const { error } = await supabase.rpc('publish_floor_layout', { p_floor_id: selectedFloorId })
      if (error) throw error
    },
    onSuccess: () => {
      refetch()
      setHasDrafts(false)
      setSuccess('Layout published — all draft assets are now live.')
      setTimeout(() => setSuccess(null), 4000)
    },
  })

  const draftCount = (assets ?? []).filter(a => a.is_draft).length

  return (
    <div className="max-w-6xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Floor Layout Editor</h1>
        {hasDrafts && (
          <button
            onClick={() => publishLayout.mutate()}
            disabled={publishLayout.isPending}
            className="flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
          >
            <Eye size={14} /> Publish layout ({draftCount} draft{draftCount !== 1 ? 's' : ''})
          </button>
        )}
      </div>

      {success && (
        <div className="rounded-lg bg-green-50 px-4 py-2 text-sm text-green-800">{success}</div>
      )}

      {/* Floor selector */}
      <div className="flex flex-wrap gap-3">
        {offices?.map(o => (
          <div key={o.id}>
            {(o.floors as { id: string; name: string }[])?.map(f => (
              <button
                key={f.id}
                onClick={() => setSelectedFloorId(f.id)}
                className={`mr-2 rounded-lg border px-3 py-1.5 text-sm ${
                  selectedFloorId === f.id
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                }`}
              >
                {o.name} / {f.name}
              </button>
            ))}
          </div>
        ))}
      </div>

      <div className="flex gap-4">
        {/* Asset palette */}
        <div className="w-72 shrink-0 space-y-4">
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <h3 className="mb-3 text-sm font-semibold text-gray-700">Add Asset</h3>

            <div className="grid grid-cols-2 gap-1.5 mb-3">
              {ASSET_PALETTE.map(p => (
                <button
                  key={p.type}
                  onClick={() => setSelectedPalette(p)}
                  className={`rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors ${
                    selectedPalette.type === p.type
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            <div className="space-y-2">
              <input
                placeholder="Code (e.g. D-01-055) *"
                value={newCode}
                onChange={e => setNewCode(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
              />
              <input
                placeholder="Display name (optional)"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
              />
              <div className="grid grid-cols-2 gap-2">
                <label className="block">
                  <span className="text-xs text-gray-500">X pos</span>
                  <input type="number" value={newX} min={0}
                    onChange={e => setNewX(Number(e.target.value))}
                    className="w-full rounded-lg border border-gray-300 px-2 py-1 text-sm" />
                </label>
                <label className="block">
                  <span className="text-xs text-gray-500">Y pos</span>
                  <input type="number" value={newY} min={0}
                    onChange={e => setNewY(Number(e.target.value))}
                    className="w-full rounded-lg border border-gray-300 px-2 py-1 text-sm" />
                </label>
              </div>
              <button
                onClick={() => addAsset.mutate()}
                disabled={!newCode || !selectedFloorId || addAsset.isPending}
                className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-blue-600 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                <Plus size={14} /> Add to draft
              </button>
            </div>
          </div>

          {/* Draft list */}
          {draftCount > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
              <p className="text-xs font-semibold text-amber-800 mb-2">
                {draftCount} unpublished change{draftCount !== 1 ? 's' : ''}
              </p>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {(assets ?? []).filter(a => a.is_draft).map(a => (
                  <div key={a.id} className="text-xs text-amber-700">{a.code} ({a.asset_type})</div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Floor map (read-only in editor — shows both published and draft) */}
        <div className="flex-1">
          {floor && assets ? (
            <FloorMap
              floor={floor}
              assets={assets}
              readonly
            />
          ) : (
            <div className="flex h-64 items-center justify-center rounded-xl border-2 border-dashed border-gray-200 text-sm text-gray-400">
              Select a floor to edit its layout
            </div>
          )}
          {draftCount > 0 && (
            <p className="mt-2 text-xs text-amber-600">
              Draft assets are shown on the map. Click <strong>Publish layout</strong> to make them visible to all users.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
