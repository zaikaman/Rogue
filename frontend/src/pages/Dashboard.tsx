import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../services/api'
import APYCard from '../components/APYCard'
import StakeForm from '../components/StakeForm'
import RiskSlider from '../components/RiskSlider'
import TransactionHistory from '../components/TransactionHistory'

export default function Dashboard() {
  const [riskProfile, setRiskProfile] = useState<'low' | 'medium' | 'high'>('medium')
  const [walletAddress, setWalletAddress] = useState<string | null>(null)
  const [positions, setPositions] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [totalRewards, setTotalRewards] = useState('0')

  // Connect wallet from context
  useEffect(() => {
    // TODO: Get from actual wallet connection context
    const walletAddr = '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1'
    setWalletAddress(walletAddr)
  }, [])

  // Fetch positions when wallet is connected
  useEffect(() => {
    if (!walletAddress) return

    const fetchPositions = async () => {
      setIsLoading(true)
      try {
        const data = await api.getPositions(walletAddress)
        setPositions(data || [])
        
        // Calculate total claimable rewards (simplified)
        const rewards = (data || []).reduce((sum: number, p: any) => {
          const daysActive = Math.floor(
            (Date.now() - new Date(p.created_at).getTime()) / (1000 * 60 * 60 * 24)
          )
          return sum + (parseFloat(p.amount || '0') * daysActive * 0.001)
        }, 0)
        setTotalRewards(rewards.toFixed(4))
      } catch (error) {
        console.error('Failed to fetch positions:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchPositions()
  }, [walletAddress])

  // Calculate aggregate stats
  const totalStaked = positions.reduce((sum, p) => sum + parseFloat(p.amount || '0'), 0)
  
  // Calculate average APY from actual strategy data
  const avgAPY = positions.length > 0 
    ? (positions.reduce((sum, p) => sum + (p.strategy?.expectedApy || 0), 0) / positions.length).toFixed(1)
    : '0'

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-white mb-2 font-mono tracking-tight">
          TERMINAL DASHBOARD
        </h1>
        <p className="text-gray-400">
          Monitor autonomous yield optimization in real-time
        </p>
      </div>

      {/* Quick Actions Banner */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link
          to="/app/swap"
          className="relative bg-gradient-to-br from-cyan-600 to-blue-600 rounded-xl p-6 overflow-hidden group hover:scale-[1.02] transition-all"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
          <div className="relative z-10">
            <div className="text-4xl mb-3">🔄</div>
            <h3 className="text-white font-bold text-xl mb-2">Token Swap</h3>
            <p className="text-cyan-100 text-sm">Cross-DEX routing via 1inch</p>
          </div>
        </Link>

        <Link
          to="/app/portfolio"
          className="relative bg-gradient-to-br from-purple-600 to-pink-600 rounded-xl p-6 overflow-hidden group hover:scale-[1.02] transition-all"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
          <div className="relative z-10">
            <div className="text-4xl mb-3">💎</div>
            <h3 className="text-white font-bold text-xl mb-2">Portfolio</h3>
            <p className="text-purple-100 text-sm">Multi-chain asset tracking</p>
          </div>
        </Link>

        <Link
          to="/app/multichain"
          className="relative bg-gradient-to-br from-violet-600 to-fuchsia-600 rounded-xl p-6 overflow-hidden group hover:scale-[1.02] transition-all"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
          <div className="relative z-10">
            <div className="text-4xl mb-3">🌐</div>
            <h3 className="text-white font-bold text-xl mb-2">Multichain Yields</h3>
            <p className="text-violet-100 text-sm">Cross-chain optimization</p>
          </div>
        </Link>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <APYCard
          title="CURRENT APY"
          value={`${avgAPY}%`}
          change="+2.1%"
          protocol="Aave V3"
        />
        <APYCard
          title="TOTAL STAKED"
          value={`$${totalStaked.toFixed(2)}`}
          change="+$1,200"
          protocol="Mixed"
        />
        <APYCard
          title="TOTAL EARNED"
          value="$847.32"
          change="+$47"
          protocol="24h"
        />
        <APYCard
          title="ATP REWARDS"
          value={`${totalRewards} ATP`}
          change="Claimable"
          protocol="Platform"
        />
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Stake Form */}
        <div className="lg:col-span-2">
          <StakeForm riskProfile={riskProfile} walletAddress={walletAddress} />
        </div>

        {/* Risk Profile */}
        <div className="terminal-border bg-noir-dark/50 rounded-sm p-6 scan-line">
          <h3 className="font-mono text-sm text-gray-400 mb-4 uppercase tracking-wide">
            Risk Profile
          </h3>
          <RiskSlider value={riskProfile} onChange={setRiskProfile} />
          
          <div className="mt-6 space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Max Leverage</span>
              <span className="text-white font-mono">
                {riskProfile === 'low' ? '1.0x' : riskProfile === 'medium' ? '1.5x' : '2.0x'}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Expected APY</span>
              <span className="text-teal-glow font-mono">
                {riskProfile === 'low' ? '8-12%' : riskProfile === 'medium' ? '12-18%' : '18-28%'}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Auto-Compound</span>
              <span className="text-success font-mono">ACTIVE</span>
            </div>
          </div>
        </div>
      </div>

      {/* Active Positions */}
      <div className="terminal-border bg-noir-dark/50 rounded-sm scan-line">
        <div className="p-6 border-b border-noir-gray/50">
          <h3 className="font-mono text-sm text-gray-400 uppercase tracking-wide">
            Active Positions
          </h3>
        </div>
        <div className="p-6">
          {isLoading ? (
            <div className="text-center py-12">
              <div className="w-8 h-8 border-2 border-teal-glow border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-gray-400 font-mono">Loading positions...</p>
            </div>
          ) : positions.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">📊</div>
              <p className="text-gray-400 mb-4">No active positions yet</p>
              <p className="text-sm text-gray-500 font-mono">
                Stake USDC or KRWQ to start earning autonomous yields
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {positions.map((position) => (
                <div
                  key={position.id}
                  className="terminal-border bg-noir-gray/30 rounded-sm p-4 hover:bg-noir-gray/50 transition-colors"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      <span className="text-white font-bold">{position.token}</span>
                      <span
                        className={`text-xs font-mono uppercase px-2 py-1 rounded ${
                          position.risk_profile === 'low'
                            ? 'bg-success/20 text-success'
                            : position.risk_profile === 'medium'
                            ? 'bg-teal-glow/20 text-teal-glow'
                            : 'bg-warning/20 text-warning'
                        }`}
                      >
                        {position.risk_profile}
                      </span>
                      <span
                        className={`text-xs font-mono uppercase px-2 py-1 rounded ${
                          position.status === 'active'
                            ? 'bg-success/20 text-success'
                            : 'bg-gray-500/20 text-gray-500'
                        }`}
                      >
                        {position.status}
                      </span>
                    </div>
                    <div className="text-right">
                      <div className="text-white font-bold">${parseFloat(position.amount).toFixed(2)}</div>
                      <div className="text-xs text-gray-500 font-mono">
                        Created {new Date(position.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <div className="text-gray-500 font-mono text-xs mb-1">Position ID</div>
                      <div className="text-white font-mono truncate">{position.id.slice(0, 8)}...</div>
                    </div>
                    <div>
                      <div className="text-gray-500 font-mono text-xs mb-1">Last Updated</div>
                      <div className="text-white font-mono">
                        {new Date(position.updated_at).toLocaleDateString()}
                      </div>
                    </div>
                    <div>
                      <div className="text-gray-500 font-mono text-xs mb-1">Actions</div>
                      <button className="text-teal-glow font-mono text-xs hover:text-white transition-colors">
                        VIEW DETAILS →
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Transaction History */}
      <TransactionHistory walletAddress={walletAddress} />

      {/* AI Agent Activity Log */}
      <div className="terminal-border bg-noir-dark/50 rounded-sm scan-line">
        <div className="p-6 border-b border-noir-gray/50">
          <h3 className="font-mono text-sm text-gray-400 uppercase tracking-wide flex items-center">
            <span className="w-2 h-2 bg-teal-glow rounded-full mr-2 pulse-glow" />
            Agent Activity Log
          </h3>
        </div>
        <div className="p-6 font-mono text-sm space-y-2">
          {[
            { time: '14:32:18', agent: 'RESEARCHER', action: 'Scanning Aave V3 yields...', status: 'success' },
            { time: '14:32:15', agent: 'ANALYZER', action: 'Optimizing allocation strategy', status: 'success' },
            { time: '14:32:10', agent: 'EXECUTOR', action: 'Compound completed: +$12.34', status: 'success' },
          ].map((log, i) => (
            <div
              key={i}
              className="flex items-start space-x-3 p-3 bg-noir-gray/30 rounded-sm hover:bg-noir-gray/50 transition-colors"
            >
              <span className="text-gray-500">[{log.time}]</span>
              <span className="text-teal-glow">{log.agent}:</span>
              <span className="text-gray-300 flex-1">{log.action}</span>
              <span className="text-success">✓</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
