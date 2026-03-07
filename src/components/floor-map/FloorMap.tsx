import { useState } from 'react'
import { cn } from '@/lib/utils'
import type { Tables } from '@/types/database'

type Asset = Tables<'workspace_assets'>

interface BookingOverlay {
  assetId: string
  status: 'confirmed' | 'pending_approval'
  userName?: string
}

interface Props {
  floor: { width_units: number; height_units: number; name: string }
  assets: Asset[]
  bookings?: BookingOverlay[]
  selectedAssetId?: string | null
  onAssetClick?: (asset: Asset) => void
  readonly?: boolean
}

// Status → fill colour (design tokens from spec)
const STATUS_FILL: Record<string, string> = {
  available:       '#22c55e', // green-500
  booked:          '#3b82f6', // blue-500
  pending:         '#f59e0b', // amber-500
  restricted:      '#6b7280', // gray-500
  unavailable:     '#ef4444', // red-500
  maintenance:     '#f97316', // orange-500
}

const LEGEND = [
  { label: 'Available', key: 'available' },
  { label: 'Booked', key: 'booked' },
  { label: 'Pending approval', key: 'pending' },
  { label: 'Restricted', key: 'restricted' },
  { label: 'Unavailable', key: 'unavailable' },
  { label: 'Maintenance', key: 'maintenance' },
]

function resolveAssetStatus(
  asset: Asset,
  bookings: BookingOverlay[],
): { displayStatus: string; userName?: string } {
  if (asset.status === 'unavailable') return { displayStatus: 'unavailable' }
  if (asset.status === 'maintenance') return { displayStatus: 'maintenance' }

  const booking = bookings.find(b => b.assetId === asset.id)
  if (booking) {
    return {
      displayStatus: booking.status === 'pending_approval' ? 'pending' : 'booked',
      userName: booking.userName,
    }
  }

  if (asset.status === 'restricted' && asset.restriction_type !== 'none') {
    return { displayStatus: 'restricted' }
  }

  return { displayStatus: 'available' }
}

interface TooltipState {
  asset: Asset
  displayStatus: string
  userName?: string
  x: number
  y: number
}

export function FloorMap({ floor, assets, bookings = [], selectedAssetId, onAssetClick, readonly }: Props) {
  const [tooltip, setTooltip] = useState<TooltipState | null>(null)

  // SVG viewBox — scale from grid units to pixel space
  const SCALE = 8 // px per grid unit
  const W = floor.width_units * SCALE
  const H = floor.height_units * SCALE

  const desks = assets.filter(a => a.asset_type === 'desk')
  const rooms = assets.filter(a => a.asset_type === 'room')
  const others = assets.filter(a => !['desk', 'room'].includes(a.asset_type))

  function handleAssetClick(asset: Asset) {
    if (readonly) return
    const { displayStatus } = resolveAssetStatus(asset, bookings)
    if (displayStatus === 'available' && onAssetClick) {
      onAssetClick(asset)
    }
  }

  function handleMouseEnter(e: React.MouseEvent<SVGRectElement>, asset: Asset) {
    const { displayStatus, userName } = resolveAssetStatus(asset, bookings)
    setTooltip({
      asset,
      displayStatus,
      userName,
      x: e.clientX,
      y: e.clientY,
    })
  }

  return (
    <div className="relative select-none">
      {/* Legend */}
      <div className="mb-3 flex flex-wrap gap-3">
        {LEGEND.map(l => (
          <div key={l.key} className="flex items-center gap-1.5 text-xs text-gray-600">
            <span
              className="inline-block h-3 w-3 rounded-sm border border-black/10"
              style={{ background: STATUS_FILL[l.key] }}
            />
            {l.label}
          </div>
        ))}
      </div>

      {/* SVG map */}
      <div className="overflow-auto rounded-lg border border-gray-200 bg-gray-50">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          width={W}
          height={H}
          aria-label={`Floor plan: ${floor.name}`}
          role="img"
        >
          {/* Background */}
          <rect width={W} height={H} fill="#f9fafb" />

          {/* Other assets (zones, amenities) */}
          {others.map(asset => (
            <rect
              key={asset.id}
              x={asset.x * SCALE}
              y={asset.y * SCALE}
              width={asset.width * SCALE}
              height={asset.height * SCALE}
              fill="#e5e7eb"
              rx={2}
              stroke="#d1d5db"
              strokeWidth={0.5}
            />
          ))}

          {/* Rooms */}
          {rooms.map(asset => {
            const { displayStatus } = resolveAssetStatus(asset, bookings)
            const fill = STATUS_FILL[displayStatus]
            const isSelected = selectedAssetId === asset.id
            return (
              <g key={asset.id}>
                <rect
                  x={asset.x * SCALE}
                  y={asset.y * SCALE}
                  width={asset.width * SCALE}
                  height={asset.height * SCALE}
                  fill={fill}
                  fillOpacity={0.25}
                  rx={4}
                  stroke={isSelected ? '#1d4ed8' : fill}
                  strokeWidth={isSelected ? 2.5 : 1.5}
                  className={cn('desk-asset', !readonly && displayStatus === 'available' && 'cursor-pointer')}
                  onClick={() => handleAssetClick(asset)}
                  onMouseEnter={e => handleMouseEnter(e, asset)}
                  onMouseLeave={() => setTooltip(null)}
                />
                <text
                  x={asset.x * SCALE + (asset.width * SCALE) / 2}
                  y={asset.y * SCALE + (asset.height * SCALE) / 2}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={8}
                  fill="#374151"
                  pointerEvents="none"
                >
                  {asset.name ?? asset.code}
                </text>
                {asset.capacity && (
                  <text
                    x={asset.x * SCALE + (asset.width * SCALE) / 2}
                    y={asset.y * SCALE + (asset.height * SCALE) / 2 + 10}
                    textAnchor="middle"
                    fontSize={6}
                    fill="#6b7280"
                    pointerEvents="none"
                  >
                    {asset.capacity} seats
                  </text>
                )}
              </g>
            )
          })}

          {/* Desks */}
          {desks.map(asset => {
            const { displayStatus } = resolveAssetStatus(asset, bookings)
            const fill = STATUS_FILL[displayStatus]
            const isSelected = selectedAssetId === asset.id
            return (
              <g key={asset.id}>
                <rect
                  x={asset.x * SCALE}
                  y={asset.y * SCALE}
                  width={asset.width * SCALE}
                  height={asset.height * SCALE}
                  fill={fill}
                  rx={2}
                  stroke={isSelected ? '#1d4ed8' : 'rgba(0,0,0,0.12)'}
                  strokeWidth={isSelected ? 2 : 0.5}
                  className={cn(
                    'desk-asset',
                    !readonly && displayStatus === 'available' && 'cursor-pointer',
                  )}
                  onClick={() => handleAssetClick(asset)}
                  onMouseEnter={e => handleMouseEnter(e, asset)}
                  onMouseLeave={() => setTooltip(null)}
                  tabIndex={!readonly && displayStatus === 'available' ? 0 : undefined}
                  role={!readonly ? 'button' : undefined}
                  aria-label={`${asset.code} – ${displayStatus}`}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') handleAssetClick(asset) }}
                />
                <text
                  x={asset.x * SCALE + (asset.width * SCALE) / 2}
                  y={asset.y * SCALE + (asset.height * SCALE) / 2}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={5}
                  fill="white"
                  pointerEvents="none"
                >
                  {asset.code.split('-').slice(-1)[0]}
                </text>
              </g>
            )
          })}
        </svg>
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="pointer-events-none fixed z-50 rounded-lg border border-gray-200 bg-white p-2.5 shadow-lg text-xs"
          style={{ left: tooltip.x + 12, top: tooltip.y - 8 }}
        >
          <p className="font-semibold text-gray-900">{tooltip.asset.name ?? tooltip.asset.code}</p>
          <p className="text-gray-500">{tooltip.asset.code}</p>
          <p className="mt-1 capitalize" style={{ color: STATUS_FILL[tooltip.displayStatus] }}>
            ● {tooltip.displayStatus.replace('_', ' ')}
          </p>
          {tooltip.userName && (
            <p className="text-gray-600">Booked by: {tooltip.userName}</p>
          )}
          {tooltip.asset.features.length > 0 && (
            <p className="mt-1 text-gray-400">{tooltip.asset.features.join(', ')}</p>
          )}
        </div>
      )}
    </div>
  )
}
