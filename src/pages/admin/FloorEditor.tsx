import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Eye, Save, Trash2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useFloorAssetsAdmin, useOffices, useFloor } from '@/hooks/useFloor'
import { FloorMap } from '@/components/floor-map/FloorMap'
import type { Tables } from '@/types/database'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any

type Asset = Tables<'workspace_assets'>
type AssetType = Asset['asset_type']

const ASSET_PALETTE: { type: AssetType; label: string; defaultW: number; defaultH: number }[] = [
  { type: 'desk',    label: 'Desk',         defaultW: 8,  defaultH: 5  },
  { type: 'room',    label: 'Meeting Room',  defaultW: 20, defaultH: 15 },
  { type: 'zone',    label: 'Zone',          defaultW: 30, defaultH: 20 },
  { type: 'amenity', label: 'Amenity',       defaultW: 6,  defaultH: 6  },
  { type: 'no_book', label: 'No-book area',  defaultW: 15, defaultH: 10 },
]

const ALL_FEATURES = [
  { key: 'standing',   label: 'Standing' },
  { key: 'monitor',    label: 'Monitor' },
  { key: 'accessible', label: 'Accessible' },
  { key: 'whiteboard', label: 'Whiteboard' },
  { key: 'video_conf', label: 'Video conf' },
  { key: 'phone',      label: 'Phone' },
  { key: 'locker',     label: 'Locker' },
]

const RESTRICTION_TYPES: Asset['restriction_type'][] = ['none', 'team', 'admin_only']

export default function AdminFloorEditor() {
  const [searchParams] = useSearchParams()
  const floorId = searchParams.get('floorId')
  const qc = useQueryClient()

  const { data: offices } = useOffices()
  const [selectedFloorId, setSelectedFloorId] = useState<string | null>(floorId)
  const { data: floor } = useFloor(selectedFloorId)
  const { data: assets, refetch } = useFloorAssetsAdmin(selectedFloorId)

  // ── Add panel ────────────────────────────────────────────────────────────────
  const [selectedPalette, setSelectedPalette] = useState<typeof ASSET_PALETTE[0]>(ASSET_PALETTE[0])
  const [newCode, setNewCode]           = useState('')
  const [newName, setNewName]           = useState('')
  const [newX, setNewX]                 = useState(5)
  const [newY, setNewY]                 = useState(5)
  const [newCapacity, setNewCapacity]   = useState<number | ''>('')
  const [newFeatures, setNewFeatures]   = useState<string[]>([])
  const [hasDrafts, setHasDrafts]       = useState(false)
  const [success, setSuccess]           = useState<string | null>(null)

  // ── Edit panel ───────────────────────────────────────────────────────────────
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null)
  const selectedAsset = (assets ?? []).find(a => a.id === selectedAssetId) ?? null

  const [editCode, setEditCode]               = useState('')
  const [editName, setEditName]               = useState('')
  const [editX, setEditX]                     = useState(0)
  const [editY, setEditY]                     = useState(0)
  const [editW, setEditW]                     = useState(0)
  const [editH, setEditH]                     = useState(0)
  const [editCapacity, setEditCapacity]       = useState<number | ''>('')
  const [editFeatures, setEditFeatures]       = useState<string[]>([])
  const [editRestriction, setEditRestriction] = useState<Asset['restriction_type']>('none')
  const [editStatus, setEditStatus]           = useState<Asset['status']>('available')
  const [confirmDelete, setConfirmDelete]     = useState(false)

  function openEditPanel(asset: Asset) {
    setSelectedAssetId(asset.id)
    setEditCode(asset.code)
    setEditName(asset.name ?? '')
    setEditX(asset.x)
    setEditY(asset.y)
    setEditW(asset.width)
    setEditH(asset.height)
    setEditCapacity(asset.capacity ?? '')
    setEditFeatures(asset.features ?? [])
    setEditRestriction(asset.restriction_type ?? 'none')
    setEditStatus(asset.status ?? 'available')
    setConfirmDelete(false)
  }

  function toggleFeature(key: string, features: string[], setFeatures: (f: string[]) => void) {
    setFeatures(features.includes(key) ? features.filter(f => f !== key) : [...features, key])
  }

  // ── Mutations ────────────────────────────────────────────────────────────────
  const addAsset = useMutation({
    mutationFn: async () => {
      if (!selectedFloorId || !newCode) return
      const { error } = await sb.from('workspace_assets').insert({
        floor_id: selectedFloorId,
        asset_type: selectedPalette.type,
        code: newCode,
        name: newName || null,
        x: newX,
        y: newY,
        width: selectedPalette.defaultW,
        height: selectedPalette.defaultH,
        capacity: (selectedPalette.type === 'room' || selectedPalette.type === 'zone') && newCapacity !== '' ? newCapacity : null,
        features: newFeatures,
        is_draft: true,
      })
      if (error) throw error
    },
    onSuccess: () => {
      refetch()
      setHasDrafts(true)
      setNewCode('')
      setNewName('')
      setNewCapacity('')
      setNewFeatures([])
    },
  })

  const updateAsset = useMutation({
    mutationFn: async () => {
      if (!selectedAssetId) return
      const { error } = await sb.from('workspace_assets').update({
        code: editCode,
        name: editName || null,
        x: editX,
        y: editY,
        width: editW,
        height: editH,
        capacity: editCapacity !== '' ? editCapacity : null,
        features: editFeatures,
        restriction_type: editRestriction,
        status: editStatus,
      }).eq('id', selectedAssetId)
      if (error) throw error
    },
    onSuccess: () => {
      refetch()
      setSuccess('Asset updated.')
      setTimeout(() => setSuccess(null), 3000)
    },
  })

  const deleteAsset = useMutation({
    mutationFn: async (): Promise<{ softDelete: boolean }> => {
      if (!selectedAssetId) return { softDelete: false }
      const today = new Date().toISOString().slice(0, 10)
      const { data: existing } = await sb
        .from('bookings')
        .select('id')
        .eq('asset_id', selectedAssetId)
        .gte('booking_date', today)
        .in('status', ['confirmed', 'pending_approval'])
        .limit(1)
      if (existing && existing.length > 0) {
        await sb.from('workspace_assets').update({ status: 'unavailable' }).eq('id', selectedAssetId)
        return { softDelete: true }
      }
      await sb.from('workspace_assets').delete().eq('id', selectedAssetId)
      return { softDelete: false }
    },
    onSuccess: (result) => {
      refetch()
      qc.invalidateQueries({ queryKey: ['floor-assets'] })
      setSelectedAssetId(null)
      setConfirmDelete(false)
      setSuccess(result.softDelete
        ? 'Asset has future bookings — marked unavailable instead of deleted.'
        : 'Asset deleted.')
      setTimeout(() => setSuccess(null), 5000)
    },
  })

  const publishLayout = useMutation({
    mutationFn: async () => {
      if (!selectedFloorId) return
      const { error } = await sb.rpc('publish_floor_layout', { p_floor_id: selectedFloorId })
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
  const showRoomFields = selectedPalette.type === 'room' || selectedPalette.type === 'zone'

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
                onClick={() => { setSelectedFloorId(f.id); setSelectedAssetId(null) }}
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
        {/* Side panel */}
        <div className="w-72 shrink-0 space-y-4">

          {/* Edit panel */}
          {selectedAsset ? (
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-700">Edit Asset</h3>
                <button onClick={() => setSelectedAssetId(null)}
                  className="text-xs text-gray-400 hover:text-gray-600">✕ Close</button>
              </div>

              <input placeholder="Code *" value={editCode}
                onChange={e => setEditCode(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm" />
              <input placeholder="Display name" value={editName}
                onChange={e => setEditName(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm" />

              <div className="grid grid-cols-2 gap-2 text-xs text-gray-500">
                {([['X', editX, setEditX], ['Y', editY, setEditY], ['Width', editW, setEditW], ['Height', editH, setEditH]] as [string, number, (n: number) => void][]).map(([label, val, setter]) => (
                  <label key={label} className="block">
                    {label}
                    <input type="number" value={val} min={0}
                      onChange={e => setter(Number(e.target.value))}
                      className="mt-0.5 w-full rounded border border-gray-300 px-2 py-1 text-sm text-gray-800" />
                  </label>
                ))}
              </div>

              {(selectedAsset.asset_type === 'room' || selectedAsset.asset_type === 'zone') && (
                <label className="block text-xs text-gray-500">
                  Capacity
                  <input type="number" value={editCapacity} min={1}
                    onChange={e => setEditCapacity(e.target.value ? Number(e.target.value) : '')}
                    className="mt-0.5 w-full rounded border border-gray-300 px-2 py-1 text-sm" />
                </label>
              )}

              <div>
                <p className="text-xs text-gray-500 mb-1">Features</p>
                <div className="flex flex-wrap gap-1">
                  {ALL_FEATURES.map(f => (
                    <button key={f.key} type="button"
                      onClick={() => toggleFeature(f.key, editFeatures, setEditFeatures)}
                      className={`rounded-full px-2 py-0.5 text-xs border transition-colors ${
                        editFeatures.includes(f.key)
                          ? 'border-blue-500 bg-blue-100 text-blue-700'
                          : 'border-gray-300 text-gray-500 hover:bg-gray-50'
                      }`}>{f.label}</button>
                  ))}
                </div>
              </div>

              <label className="block text-xs text-gray-500">
                Restriction
                <select value={editRestriction}
                  onChange={e => setEditRestriction(e.target.value as Asset['restriction_type'])}
                  className="mt-0.5 w-full rounded border border-gray-300 px-2 py-1 text-sm">
                  {RESTRICTION_TYPES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </label>

              <label className="block text-xs text-gray-500">
                Status
                <select value={editStatus}
                  onChange={e => setEditStatus(e.target.value as Asset['status'])}
                  className="mt-0.5 w-full rounded border border-gray-300 px-2 py-1 text-sm">
                  {(['available', 'unavailable', 'maintenance'] as Asset['status'][]).map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </label>

              <div className="flex gap-2 pt-1">
                <button onClick={() => updateAsset.mutate()} disabled={!editCode || updateAsset.isPending}
                  className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-blue-600 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
                  <Save size={14} /> Save
                </button>
                {!confirmDelete ? (
                  <button onClick={() => setConfirmDelete(true)}
                    className="flex items-center gap-1 rounded-lg border border-red-300 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50">
                    <Trash2 size={14} />
                  </button>
                ) : (
                  <button onClick={() => deleteAsset.mutate()} disabled={deleteAsset.isPending}
                    className="flex-1 rounded-lg bg-red-600 px-2 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50">
                    Confirm delete
                  </button>
                )}
              </div>
              {confirmDelete && (
                <p className="text-[10px] text-red-500">
                  Assets with future bookings will be marked unavailable instead.
                </p>
              )}
            </div>
          ) : (
            /* Add panel */
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <h3 className="mb-3 text-sm font-semibold text-gray-700">Add Asset</h3>

              <div className="grid grid-cols-2 gap-1.5 mb-3">
                {ASSET_PALETTE.map(p => (
                  <button key={p.type}
                    onClick={() => { setSelectedPalette(p); setNewCapacity(''); setNewFeatures([]) }}
                    className={`rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors ${
                      selectedPalette.type === p.type
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}>
                    {p.label}
                  </button>
                ))}
              </div>

              <div className="space-y-2">
                <input placeholder="Code (e.g. D-01-055) *" value={newCode}
                  onChange={e => setNewCode(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm" />
                <input placeholder="Display name (optional)" value={newName}
                  onChange={e => setNewName(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm" />
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

                {showRoomFields && (
                  <>
                    <label className="block">
                      <span className="text-xs text-gray-500">Capacity</span>
                      <input type="number" value={newCapacity} min={1}
                        onChange={e => setNewCapacity(e.target.value ? Number(e.target.value) : '')}
                        className="w-full rounded-lg border border-gray-300 px-2 py-1 text-sm" />
                    </label>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Features</p>
                      <div className="flex flex-wrap gap-1">
                        {ALL_FEATURES.filter(f => ['whiteboard', 'video_conf', 'phone', 'accessible'].includes(f.key)).map(f => (
                          <button key={f.key} type="button"
                            onClick={() => toggleFeature(f.key, newFeatures, setNewFeatures)}
                            className={`rounded-full px-2 py-0.5 text-xs border transition-colors ${
                              newFeatures.includes(f.key)
                                ? 'border-blue-500 bg-blue-50 text-blue-700'
                                : 'border-gray-300 text-gray-500 hover:bg-gray-50'
                            }`}>{f.label}</button>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                <button onClick={() => addAsset.mutate()}
                  disabled={!newCode || !selectedFloorId || addAsset.isPending}
                  className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-blue-600 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
                  <Plus size={14} /> Add to draft
                </button>
              </div>
            </div>
          )}

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

        {/* Floor map */}
        <div className="flex-1">
          {floor && assets ? (
            <FloorMap
              floor={floor}
              assets={assets}
              selectedAssetId={selectedAssetId ?? undefined}
              onAssetClick={asset => openEditPanel(asset)}
              readonly={false}
              editorMode={true}
            />
          ) : (
            <div className="flex h-64 items-center justify-center rounded-xl border-2 border-dashed border-gray-200 text-sm text-gray-400">
              Select a floor to edit its layout
            </div>
          )}
          <p className="mt-2 text-xs text-gray-400">
            {selectedAsset
              ? `Editing: ${selectedAsset.code}. Click another asset to switch.`
              : 'Click any asset on the map to select and edit it.'}
          </p>
          {draftCount > 0 && (
            <p className="mt-1 text-xs text-amber-600">
              Draft assets shown on map. Click <strong>Publish layout</strong> to make them live.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
