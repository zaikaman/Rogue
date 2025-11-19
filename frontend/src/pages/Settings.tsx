import { HugeiconsIcon } from '@hugeicons/react'
import { PlusMinusIcon } from '@hugeicons/core-free-icons'

export default function Settings() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2 font-mono tracking-tight">
          SETTINGS
        </h1>
        <p className="text-gray-400">Configure your automation preferences</p>
      </div>

      <div className="grid gap-6">
        {/* Auto-Compound */}
        <div className="terminal-border bg-noir-dark/50 rounded-sm p-6 scan-line">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-mono text-sm text-white uppercase mb-1">Auto-Compound</h3>
              <p className="text-sm text-gray-400">Automatically reinvest yields</p>
            </div>
            <button className="relative w-14 h-7 bg-teal-glow rounded-full glow-teal">
              <div className="absolute right-1 top-1 w-5 h-5 bg-noir-black rounded-full transition-all" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-4 mt-4">
            <div className="bg-noir-gray/30 rounded-sm p-3">
              <div className="text-xs text-gray-500 font-mono mb-1">Frequency</div>
              <div className="text-white font-mono">Every 24h</div>
            </div>
            <div className="bg-noir-gray/30 rounded-sm p-3">
              <div className="text-xs text-gray-500 font-mono mb-1">Min Amount</div>
              <div className="text-white font-mono">$10</div>
            </div>
          </div>
        </div>

        {/* Rebalancing */}
        <div className="terminal-border bg-noir-dark/50 rounded-sm p-6 scan-line">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-mono text-sm text-white uppercase mb-1">Auto-Rebalance</h3>
              <p className="text-sm text-gray-400">Optimize allocations based on yields</p>
            </div>
            <button className="relative w-14 h-7 bg-teal-glow rounded-full glow-teal">
              <div className="absolute right-1 top-1 w-5 h-5 bg-noir-black rounded-full transition-all" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-4 mt-4">
            <div className="bg-noir-gray/30 rounded-sm p-3">
              <div className="text-xs text-gray-500 font-mono mb-1">Trigger</div>
              <div className="text-white font-mono flex items-center gap-1">
                <HugeiconsIcon icon={PlusMinusIcon} size={14} /> 5% APY
              </div>
            </div>
            <div className="bg-noir-gray/30 rounded-sm p-3">
              <div className="text-xs text-gray-500 font-mono mb-1">Max Slippage</div>
              <div className="text-white font-mono">0.5%</div>
            </div>
          </div>
        </div>

        {/* Notifications */}
        <div className="terminal-border bg-noir-dark/50 rounded-sm p-6 scan-line">
          <h3 className="font-mono text-sm text-white uppercase mb-4">Notifications</h3>
          <div className="space-y-3">
            {[
              { label: 'Transaction Confirmations', enabled: true },
              { label: 'Position Updates', enabled: true },
              { label: 'Agent Errors', enabled: true },
              { label: 'APY Changes >5%', enabled: false },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between py-2">
                <span className="text-gray-400 text-sm">{item.label}</span>
                <button
                  className={`relative w-12 h-6 rounded-full transition-all ${
                    item.enabled ? 'bg-teal-glow' : 'bg-noir-gray'
                  }`}
                >
                  <div
                    className={`absolute top-1 w-4 h-4 bg-noir-black rounded-full transition-all ${
                      item.enabled ? 'right-1' : 'left-1'
                    }`}
                  />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
