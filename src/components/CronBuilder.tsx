import { useState, useEffect } from 'react'
import { ChevronDown } from 'lucide-react'
import { parseCron, buildCron, describeCron, type CronParts } from '@/lib/cron'

interface Props {
  value: string               // current cron expression
  onChange: (cron: string) => void
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const HOURS = Array.from({ length: 24 }, (_, i) => i)
const MINUTES = [0, 15, 30, 45]

export function CronBuilder({ value, onChange }: Props) {
  const [parts, setParts] = useState<CronParts>(() => parseCron(value))
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [advancedValue, setAdvancedValue] = useState(value)

  // Sync from parent when value prop changes externally
  useEffect(() => {
    setParts(parseCron(value))
    setAdvancedValue(value)
  }, [value])

  function update(next: Partial<CronParts>) {
    const newParts = { ...parts, ...next }
    setParts(newParts)
    const cron = buildCron(newParts)
    setAdvancedValue(cron)
    onChange(cron)
  }

  function toggleDay(day: number) {
    const days = parts.days.includes(day)
      ? parts.days.filter(d => d !== day)
      : [...parts.days, day]
    update({ days })
  }

  function applyAdvanced(raw: string) {
    const parsed = parseCron(raw)
    setParts(parsed)
    setAdvancedValue(raw)
    onChange(raw)
  }

  return (
    <div className="space-y-3">
      {/* Time row */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500 w-12">Time</span>
        <select
          value={parts.hour}
          onChange={e => update({ hour: Number(e.target.value) })}
          className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
        >
          {HOURS.map(h => (
            <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>
          ))}
        </select>
        <span className="text-xs text-gray-400">:</span>
        <select
          value={parts.minute}
          onChange={e => update({ minute: Number(e.target.value) })}
          className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
        >
          {MINUTES.map(m => (
            <option key={m} value={m}>{String(m).padStart(2, '0')}</option>
          ))}
        </select>
      </div>

      {/* Days row */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500 w-12">Days</span>
        <div className="flex gap-1">
          {DAY_LABELS.map((label, i) => (
            <button
              key={i}
              type="button"
              onClick={() => toggleDay(i)}
              className={`h-8 w-9 rounded-lg text-xs font-medium transition-colors ${
                parts.days.includes(i) || parts.days.length === 0
                  ? 'bg-blue-600 text-white'
                  : 'border border-gray-300 text-gray-500 hover:bg-gray-50'
              }`}
              title={parts.days.length === 0 ? 'Every day (click to specify days)' : label}
            >
              {label}
            </button>
          ))}
          {parts.days.length > 0 && (
            <button
              type="button"
              onClick={() => update({ days: [] })}
              className="ml-1 rounded-lg border border-gray-300 px-2 py-1 text-xs text-gray-500 hover:bg-gray-50"
              title="Reset to every day"
            >
              Every day
            </button>
          )}
        </div>
      </div>

      {/* Human-readable preview */}
      <p className="text-sm text-blue-700 font-medium pl-14">
        {describeCron(parts)}
      </p>

      {/* Advanced toggle */}
      <div>
        <button
          type="button"
          onClick={() => setShowAdvanced(v => !v)}
          className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600"
        >
          <ChevronDown size={12} className={showAdvanced ? 'rotate-180 transition-transform' : 'transition-transform'} />
          Advanced (raw cron)
        </button>
        {showAdvanced && (
          <div className="mt-2 flex items-center gap-2">
            <code className="text-xs text-gray-400">cron:</code>
            <input
              value={advancedValue}
              onChange={e => setAdvancedValue(e.target.value)}
              onBlur={e => applyAdvanced(e.target.value)}
              className="flex-1 rounded-lg border border-gray-300 px-3 py-1.5 font-mono text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>
        )}
        {showAdvanced && (
          <p className="mt-1 text-xs text-gray-400">
            5-field format: minute hour day-of-month month day-of-week
          </p>
        )}
      </div>
    </div>
  )
}
