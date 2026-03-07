export default function AdminPolicies() {
  return (
    <div className="max-w-2xl space-y-4">
      <h1 className="text-xl font-semibold text-gray-900">Booking Policies</h1>
      <div className="rounded-xl border border-gray-200 bg-white p-6 space-y-4">
        <PolicyRow
          label="Self-service booking window"
          description="Bookings up to this many days ahead are confirmed immediately."
          defaultValue="14"
          unit="days"
        />
        <PolicyRow
          label="Maximum advance booking window"
          description="Requests beyond this are rejected."
          defaultValue="180"
          unit="days"
        />
        <PolicyRow
          label="Cancellation cut-off"
          description="Bookings cannot be cancelled within this many hours of the booking date."
          defaultValue="0"
          unit="hours"
        />
        <div className="pt-2">
          <p className="text-xs text-gray-400">
            Policy configuration is persisted per organisation. Changes take effect immediately for new bookings.
          </p>
        </div>
      </div>
    </div>
  )
}

function PolicyRow({
  label, description, defaultValue, unit,
}: { label: string; description: string; defaultValue: string; unit: string }) {
  return (
    <div className="flex items-start justify-between gap-6 border-b border-gray-100 pb-4 last:border-0 last:pb-0">
      <div className="flex-1">
        <p className="text-sm font-medium text-gray-900">{label}</p>
        <p className="text-xs text-gray-500">{description}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <input
          type="number"
          defaultValue={defaultValue}
          min={0}
          className="w-20 rounded-lg border border-gray-300 px-2 py-1 text-sm text-right"
        />
        <span className="text-sm text-gray-500">{unit}</span>
      </div>
    </div>
  )
}
