export default function Positions() {
  const positions = [
    {
      id: '1',
      token: 'USDC',
      amount: '5,000',
      apy: '14.2%',
      earned: '$284.32',
      protocol: 'Aave V3',
      risk: 'medium',
      status: 'active',
    },
    {
      id: '2',
      token: 'USDC',
      amount: '2,500',
      apy: '18.7%',
      earned: '$156.89',
      protocol: 'Frax',
      risk: 'high',
      status: 'active',
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2 font-mono tracking-tight">
          ACTIVE POSITIONS
        </h1>
        <p className="text-gray-400">Manage your staked assets and track performance</p>
      </div>

      <div className="grid gap-4">
        {positions.map((position) => (
          <div
            key={position.id}
            className="terminal-border bg-noir-dark/50 rounded-sm p-6 hover:glow-teal transition-all duration-300 scan-line"
          >
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              {/* Left: Token Info */}
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-gradient-teal rounded-sm flex items-center justify-center font-bold text-noir-black text-lg glow-teal">
                  {position.token.charAt(0)}
                </div>
                <div>
                  <div className="text-xl font-bold text-white">{position.amount} {position.token}</div>
                  <div className="text-sm text-gray-400 font-mono">{position.protocol}</div>
                </div>
              </div>

              {/* Middle: Stats */}
              <div className="grid grid-cols-3 gap-6 flex-1">
                <div>
                  <div className="text-xs text-gray-500 font-mono mb-1">APY</div>
                  <div className="text-lg font-bold text-teal-glow">{position.apy}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 font-mono mb-1">EARNED</div>
                  <div className="text-lg font-bold text-success">{position.earned}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 font-mono mb-1">RISK</div>
                  <div
                    className={`text-lg font-bold uppercase ${
                      position.risk === 'low'
                        ? 'text-success'
                        : position.risk === 'medium'
                        ? 'text-teal-glow'
                        : 'text-warning'
                    }`}
                  >
                    {position.risk}
                  </div>
                </div>
              </div>

              {/* Right: Actions */}
              <div className="flex gap-3">
                <button className="px-4 py-2 terminal-border text-teal-glow font-mono text-sm rounded-sm hover:bg-noir-gray/50 transition-all">
                  ADJUST
                </button>
                <button className="px-4 py-2 bg-danger/20 text-danger font-mono text-sm rounded-sm hover:bg-danger/30 transition-all">
                  UNSTAKE
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
