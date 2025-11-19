import { useState, useEffect } from 'react'
import { useAccount } from 'wagmi'
import { api } from '../services/api'

export default function Positions() {
  const { address: walletAddress, isConnected } = useAccount()
  const [positions, setPositions] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (!isConnected || !walletAddress) {
      setPositions([])
      return
    }

    const fetchPositions = async () => {
      setIsLoading(true)
      try {
        const data = await api.getPositions(walletAddress)
        
        // Map API data to UI model
        const mappedPositions = data.map((p: any) => {
          // Calculate estimated earned based on time active (simplified simulation)
          const daysActive = Math.floor(
            (Date.now() - new Date(p.created_at).getTime()) / (1000 * 60 * 60 * 24)
          )
          const earned = (parseFloat(p.amount || '0') * daysActive * 0.001).toFixed(2)
          
          return {
            id: p.id,
            token: p.token,
            amount: parseFloat(p.amount).toLocaleString(),
            apy: p.strategy?.expected_apy ? `${p.strategy.expected_apy}%` : 'N/A',
            earned: `$${earned}`,
            protocol: p.strategy?.protocol || 'Pending',
            risk: p.risk_profile,
            status: p.status,
          }
        })
        setPositions(mappedPositions)
      } catch (error) {
        console.error('Failed to fetch positions:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchPositions()
  }, [walletAddress, isConnected])

  if (isLoading) {
    return <div className="text-white">Loading positions...</div>
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2 font-mono tracking-tight">
          ACTIVE POSITIONS
        </h1>
        <p className="text-gray-400">Manage your staked assets and track performance</p>
      </div>

      {!isConnected ? (
        <div className="text-center py-12 text-gray-400">
          Please connect your wallet to view positions
        </div>
      ) : positions.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          No active positions found
        </div>
      ) : (
        <div className="grid gap-4">
          {positions.map((position) => (
            <div
              key={position.id}
              className="terminal-border bg-noir-dark/50 rounded-sm p-6 hover:glow-red transition-all duration-300 scan-line"
            >
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                {/* Left: Token Info */}
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-gradient-red rounded-sm flex items-center justify-center font-bold text-noir-black text-lg glow-red">
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
                    <div className="text-lg font-bold text-red-glow">{position.apy}</div>
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
                          ? 'text-red-glow'
                          : 'text-warning'
                      }`}
                    >
                      {position.risk}
                    </div>
                  </div>
                </div>

                {/* Right: Actions */}
                <div className="flex gap-3">
                  <button className="px-4 py-2 terminal-border text-red-glow font-mono text-sm rounded-sm hover:bg-noir-gray/50 transition-all">
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
      )}
    </div>
  )
}
