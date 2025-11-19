import { useState } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import { Alert02Icon } from '@hugeicons/core-free-icons'

interface AllocationSliderProps {
  currentAllocations: Record<string, number>
  onUpdate: (newAllocations: Record<string, number>) => void
  isLoading?: boolean
}

export default function AllocationSlider({
  currentAllocations,
  onUpdate,
  isLoading = false
}: AllocationSliderProps) {
  const [allocations, setAllocations] = useState(currentAllocations)
  const [hasChanges, setHasChanges] = useState(false)

  // Get protocol names and sort by allocation percentage
  const protocols = Object.entries(allocations).sort((a, b) => b[1] - a[1])

  // Handle slider change
  const handleSliderChange = (protocol: string, newValue: number) => {
    const remaining = Object.entries(allocations)
      .filter(([p]) => p !== protocol)
      .reduce((sum, [, val]) => sum + val, 0)

    // Ensure total = 100%
    if (newValue + remaining > 100) {
      newValue = 100 - remaining
    }

    const updated = {
      ...allocations,
      [protocol]: newValue
    }

    setAllocations(updated)
    setHasChanges(true)
  }

  // Auto-balance: distribute remaining % proportionally
  const handleAutoBalance = () => {
    const total = Object.values(allocations).reduce((sum, val) => sum + val, 0)
    
    if (total === 100) return

    const diff = 100 - total
    const protocolCount = protocols.length
    const adjustment = diff / protocolCount

    const balanced = Object.fromEntries(
      Object.entries(allocations).map(([protocol, value]) => [
        protocol,
        Math.max(0, Math.min(100, value + adjustment))
      ])
    )

    setAllocations(balanced)
    setHasChanges(true)
  }

  // Apply changes
  const handleApply = () => {
    onUpdate(allocations)
    setHasChanges(false)
  }

  // Reset to current
  const handleReset = () => {
    setAllocations(currentAllocations)
    setHasChanges(false)
  }

  // Calculate total allocation
  const totalAllocation = Object.values(allocations).reduce((sum, val) => sum + val, 0)
  const isValid = Math.abs(totalAllocation - 100) < 0.01

  return (
    <div className="terminal-border bg-noir-dark/50 rounded-sm p-6 scan-line">
      <div className="flex items-center justify-between mb-6">
        <h3 className="font-mono text-sm text-gray-400 uppercase tracking-wide">
          Protocol Allocations
        </h3>
        <button
          onClick={handleAutoBalance}
          className="text-xs font-mono text-teal-glow hover:text-white transition-colors"
        >
          AUTO-BALANCE
        </button>
      </div>

      {/* Total Allocation Indicator */}
      <div className="mb-6 terminal-border bg-noir-gray/30 rounded-sm p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-gray-400 font-mono">Total Allocation</span>
          <span
            className={`text-lg font-bold font-mono ${
              isValid ? 'text-success' : 'text-warning'
            }`}
          >
            {totalAllocation.toFixed(1)}%
          </span>
        </div>
        <div className="h-2 bg-noir-gray rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ${
              isValid ? 'bg-gradient-teal' : 'bg-gradient-to-r from-warning to-red-500'
            }`}
            style={{ width: `${Math.min(100, totalAllocation)}%` }}
          />
        </div>
        {!isValid && (
          <p className="text-xs text-warning font-mono mt-2">
            Total must equal 100%
          </p>
        )}
      </div>

      {/* Protocol Sliders */}
      <div className="space-y-6 mb-6">
        {protocols.map(([protocol, percentage]) => (
          <div key={protocol}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-white font-mono">{protocol}</span>
              <span className="text-sm text-teal-glow font-mono font-bold">
                {percentage.toFixed(1)}%
              </span>
            </div>
            
            <div className="relative">
              {/* Slider Track */}
              <div className="h-8 bg-noir-gray rounded-sm relative overflow-hidden">
                <div
                  className="absolute inset-y-0 left-0 bg-gradient-teal transition-all duration-200"
                  style={{ width: `${percentage}%` }}
                />
              </div>

              {/* Slider Input */}
              <input
                type="range"
                min="0"
                max="100"
                step="1"
                value={percentage}
                onChange={(e) => handleSliderChange(protocol, parseFloat(e.target.value))}
                className="absolute inset-0 w-full h-8 opacity-0 cursor-pointer"
                disabled={isLoading}
              />

              {/* Tick Marks */}
              <div className="flex justify-between mt-1 px-1">
                <span className="text-xs text-gray-600 font-mono">0%</span>
                <span className="text-xs text-gray-600 font-mono">25%</span>
                <span className="text-xs text-gray-600 font-mono">50%</span>
                <span className="text-xs text-gray-600 font-mono">75%</span>
                <span className="text-xs text-gray-600 font-mono">100%</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Impact Preview */}
      {hasChanges && (
        <div className="mb-6 terminal-border bg-teal-glow/10 border-teal-glow rounded-sm p-4">
          <div className="flex items-center space-x-2 mb-2">
            <span className="text-teal-glow">
              <HugeiconsIcon icon={Alert02Icon} size={16} />
            </span>
            <span className="text-sm text-teal-glow font-mono">Pending Changes</span>
          </div>
          <p className="text-xs text-gray-400 font-mono">
            Rebalancing will trigger on-chain transactions. Gas fees may apply.
          </p>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex space-x-3">
        <button
          onClick={handleApply}
          disabled={!hasChanges || !isValid || isLoading}
          className={`
            flex-1 py-3 rounded-sm font-bold text-sm transition-all duration-300
            ${
              hasChanges && isValid && !isLoading
                ? 'bg-gradient-teal text-noir-black hover:glow-teal-intense'
                : 'bg-noir-gray/50 text-gray-600 cursor-not-allowed'
            }
          `}
        >
          {isLoading ? (
            <span className="flex items-center justify-center space-x-2">
              <div className="w-4 h-4 border-2 border-noir-black border-t-transparent rounded-full animate-spin" />
              <span>REBALANCING...</span>
            </span>
          ) : (
            'APPLY CHANGES'
          )}
        </button>
        <button
          onClick={handleReset}
          disabled={!hasChanges || isLoading}
          className="px-6 py-3 terminal-border text-gray-400 hover:text-white hover:bg-noir-gray/50 transition-all rounded-sm font-mono text-sm disabled:opacity-50"
        >
          RESET
        </button>
      </div>

      {/* Info */}
      <p className="mt-4 text-xs text-gray-500 text-center font-mono">
        AI agents will execute rebalancing autonomously within 24 hours
      </p>
    </div>
  )
}
