import { HugeiconsIcon } from '@hugeicons/react'
import { ArrowUpRight01Icon, ArrowDownRight01Icon } from '@hugeicons/core-free-icons'

interface APYCardProps {
  title: string
  value: string
  change: string
  protocol: string
}

export default function APYCard({ title, value, change, protocol }: APYCardProps) {
  const isPositive = change.startsWith('+')

  return (
    <div className="terminal-border bg-noir-dark/50 backdrop-blur rounded-sm p-6 scan-line hover:glow-teal transition-all duration-300 group">
      <div className="flex items-start justify-between mb-4">
        <div className="font-mono text-xs text-gray-500 uppercase tracking-wider">
          {title}
        </div>
        <div className="px-2 py-1 bg-noir-gray/50 rounded text-xs font-mono text-teal-glow">
          {protocol}
        </div>
      </div>

      <div className="space-y-2">
        <div className="text-4xl font-bold text-white group-hover:text-glow transition-all">
          {value}
        </div>
        <div
          className={`flex items-center space-x-1 text-sm font-mono ${
            isPositive ? 'text-success' : 'text-danger'
          }`}
        >
          <span>
            <HugeiconsIcon icon={isPositive ? ArrowUpRight01Icon : ArrowDownRight01Icon} size={14} />
          </span>
          <span>{change}</span>
        </div>
      </div>

      {/* Subtle pulse effect on hover */}
      <div className="mt-4 h-1 bg-noir-gray rounded-full overflow-hidden">
        <div className="h-full bg-gradient-teal w-3/4 group-hover:w-full transition-all duration-500" />
      </div>
    </div>
  )
}
