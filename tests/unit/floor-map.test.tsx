import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { FloorMap } from '@/components/floor-map/FloorMap'
import type { Tables } from '@/types/database'

type Asset = Tables<'workspace_assets'>

const mockFloor = { width_units: 50, height_units: 30, name: 'Test Floor' }

function makeAsset(overrides: Partial<Asset> = {}): Asset {
  return {
    id: 'asset-1',
    floor_id: 'floor-1',
    asset_type: 'desk',
    code: 'D-001',
    name: 'Desk 001',
    x: 5, y: 5, width: 8, height: 5,
    capacity: null,
    features: [],
    status: 'available',
    restriction_type: 'none',
    restricted_user_id: null,
    restricted_team_id: null,
    is_draft: false,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

describe('FloorMap', () => {
  it('renders legend items', () => {
    render(<FloorMap floor={mockFloor} assets={[]} />)
    expect(screen.getByText('Available')).toBeInTheDocument()
    expect(screen.getByText('Booked')).toBeInTheDocument()
    expect(screen.getByText('Maintenance')).toBeInTheDocument()
  })

  it('renders floor plan SVG with aria-label', () => {
    render(<FloorMap floor={mockFloor} assets={[]} />)
    expect(screen.getByRole('img', { name: /Test Floor/i })).toBeInTheDocument()
  })

  it('renders a desk with correct aria-label', () => {
    const asset = makeAsset()
    render(<FloorMap floor={mockFloor} assets={[asset]} />)
    expect(screen.getByRole('button', { name: /D-001/i })).toBeInTheDocument()
  })

  it('desk shows as booked when booking overlay provided', () => {
    const asset = makeAsset()
    render(
      <FloorMap
        floor={mockFloor}
        assets={[asset]}
        bookings={[{ assetId: asset.id, status: 'confirmed', userName: 'Jane Smith' }]}
      />
    )
    // Booked desk should not be a focusable button
    expect(screen.queryByRole('button', { name: /D-001/i })).not.toBeInTheDocument()
  })

  it('renders in readonly mode — no clickable desks', () => {
    const asset = makeAsset()
    render(<FloorMap floor={mockFloor} assets={[asset]} readonly />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})
