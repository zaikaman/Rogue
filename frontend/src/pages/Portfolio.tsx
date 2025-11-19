import { useState, useEffect } from 'react'
import { useAccount } from 'wagmi'
import { api } from '../services/api'

interface TokenHolding {
  symbol: string
  name: string
  balance: string
  valueUsd: number
  chain: string
  apy?: number
  protocol?: string
  icon?: string
}

const CHAIN_COLORS = {
  amoy: 'from-purple-500 to-violet-600',
  sepolia: 'from-blue-500 to-cyan-600',
  base_sepolia: 'from-indigo-500 to-blue-600'
}

const CHAIN_ICONS = {
  amoy: '⬡',
  sepolia: '⟠',
  base_sepolia: '🔵'
}

export default function Portfolio() {
  const { address: walletAddress, isConnected } = useAccount()
  const [holdings, setHoldings] = useState<TokenHolding[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [selectedChain, setSelectedChain] = useState<string>('all')
  const [sortBy, setSortBy] = useState<'value' | 'apy'>('value')

  useEffect(() => {
    if (!isConnected || !walletAddress) {
      setHoldings([])
      return
    }

    const fetchPortfolio = async () => {
      setIsLoading(true)
      try {
        const data = await api.getPortfolioHoldings(walletAddress)
        // Map API data to UI model (adding icons if needed)
        const mappedHoldings = data.map((h: any) => ({
          ...h,
          icon: h.symbol === 'USDC' ? '💵' : h.symbol === 'ETH' ? '⟠' : h.symbol === 'MATIC' ? '⬡' : '◈'
        }))
        setHoldings(mappedHoldings)
      } catch (error) {
        console.error('Failed to fetch portfolio:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchPortfolio()
  }, [walletAddress, isConnected])

  // Calculate totals
  const totalValue = holdings.reduce((sum, h) => sum + h.valueUsd, 0)
  const totalByChain = holdings.reduce((acc, h) => {
    acc[h.chain] = (acc[h.chain] || 0) + h.valueUsd
    return acc
  }, {} as Record<string, number>)

  const filteredHoldings = holdings
    .filter(h => selectedChain === 'all' || h.chain === selectedChain)
    .sort((a, b) => {
      if (sortBy === 'value') return b.valueUsd - a.valueUsd
      return (b.apy || 0) - (a.apy || 0)
    })

  const activeFarms = holdings.filter(h => h.protocol).length
  const avgAPY = holdings.filter(h => h.apy).reduce((sum, h) => sum + (h.apy || 0), 0) / activeFarms || 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-cyan-400 to-purple-500 mb-2 tracking-tight" style={{ fontFamily: 'Space Grotesk, monospace' }}>
            PORTFOLIO NEXUS
          </h1>
          <p className="text-slate-400 font-mono text-sm">
            Multi-chain asset dashboard • Real-time yield tracking
          </p>
        </div>

        {/* Chain Filter */}
        <div className="flex gap-2">
          <button
            onClick={() => setSelectedChain('all')}
            className={`px-5 py-2.5 rounded-lg font-mono text-sm font-bold transition-all ${
              selectedChain === 'all'
                ? 'bg-gradient-to-r from-emerald-500 to-cyan-500 text-white shadow-[0_0_20px_rgba(16,185,129,0.4)]'
                : 'bg-slate-900/80 text-slate-400 border border-slate-800 hover:border-emerald-500/50'
            }`}
          >
            ALL CHAINS
          </button>
          {Object.keys(totalByChain).map((chain) => (
            <button
              key={chain}
              onClick={() => setSelectedChain(chain)}
              className={`px-4 py-2.5 rounded-lg font-mono text-sm font-bold transition-all ${
                selectedChain === chain
                  ? `bg-gradient-to-r ${CHAIN_COLORS[chain as keyof typeof CHAIN_COLORS]} text-white shadow-lg`
                  : 'bg-slate-900/80 text-slate-400 border border-slate-800 hover:border-slate-700'
              }`}
            >
              {CHAIN_ICONS[chain as keyof typeof CHAIN_ICONS]} {chain.toUpperCase().replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Overview Cards */}
      {isLoading ? (
        <div className="text-center py-12 text-gray-400">Loading portfolio...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
          {/* Total Value */}
        <div className="relative bg-gradient-to-br from-slate-900 to-slate-950 border-2 border-emerald-500/30 rounded-2xl p-6 overflow-hidden group hover:border-emerald-500/60 transition-all">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-3">
              <span className="text-slate-400 font-mono text-xs uppercase tracking-wider">Total Value</span>
              <span className="text-3xl">💎</span>
            </div>
            <div className="text-4xl font-black text-white mb-1">
              ${totalValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
            <div className="text-emerald-400 font-mono text-sm">
              +$247.32 (24h)
            </div>
          </div>
        </div>

        {/* Active Positions */}
        <div className="relative bg-gradient-to-br from-slate-900 to-slate-950 border-2 border-cyan-500/30 rounded-2xl p-6 overflow-hidden group hover:border-cyan-500/60 transition-all">
          <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-3">
              <span className="text-slate-400 font-mono text-xs uppercase tracking-wider">Active Farms</span>
              <span className="text-3xl">🌾</span>
            </div>
            <div className="text-4xl font-black text-white mb-1">
              {activeFarms}
            </div>
            <div className="text-cyan-400 font-mono text-sm">
              Across {Object.keys(totalByChain).length} chains
            </div>
          </div>
        </div>

        {/* Average APY */}
        <div className="relative bg-gradient-to-br from-slate-900 to-slate-950 border-2 border-purple-500/30 rounded-2xl p-6 overflow-hidden group hover:border-purple-500/60 transition-all">
          <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-3">
              <span className="text-slate-400 font-mono text-xs uppercase tracking-wider">Avg APY</span>
              <span className="text-3xl">📈</span>
            </div>
            <div className="text-4xl font-black text-white mb-1">
              {avgAPY.toFixed(1)}%
            </div>
            <div className="text-purple-400 font-mono text-sm">
              ${(totalValue * avgAPY / 100 / 365).toFixed(2)}/day
            </div>
          </div>
        </div>

        {/* Total Chains */}
        <div className="relative bg-gradient-to-br from-slate-900 to-slate-950 border-2 border-orange-500/30 rounded-2xl p-6 overflow-hidden group hover:border-orange-500/60 transition-all">
          <div className="absolute inset-0 bg-gradient-to-br from-orange-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-3">
              <span className="text-slate-400 font-mono text-xs uppercase tracking-wider">Chains</span>
              <span className="text-3xl">🔗</span>
            </div>
            <div className="text-4xl font-black text-white mb-1">
              {Object.keys(totalByChain).length}
            </div>
            <div className="text-orange-400 font-mono text-sm">
              Multi-chain diversified
            </div>
          </div>
        </div>
        </div>
      )}

      {/* Holdings Table */}
      <div className="bg-slate-900/80 border-2 border-slate-800 rounded-2xl overflow-hidden">
        {/* Table Header */}
        <div className="bg-slate-950/80 px-8 py-5 border-b border-slate-800">
          <div className="flex items-center justify-between">
            <h3 className="font-mono text-sm text-slate-400 uppercase tracking-wider">
              Holdings ({filteredHoldings.length})
            </h3>
            <div className="flex gap-2">
              <button
                onClick={() => setSortBy('value')}
                className={`px-4 py-2 rounded-lg font-mono text-xs transition-all ${
                  sortBy === 'value'
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50'
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                BY VALUE
              </button>
              <button
                onClick={() => setSortBy('apy')}
                className={`px-4 py-2 rounded-lg font-mono text-xs transition-all ${
                  sortBy === 'apy'
                    ? 'bg-purple-500/20 text-purple-400 border border-purple-500/50'
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                BY APY
              </button>
            </div>
          </div>
        </div>

        {/* Table Body */}
        <div className="divide-y divide-slate-800">
          {filteredHoldings.map((holding, index) => (
            <div
              key={index}
              className="px-8 py-6 hover:bg-slate-800/40 transition-all duration-200 group"
            >
              <div className="flex items-center justify-between">
                {/* Token Info */}
                <div className="flex items-center gap-5 flex-1">
                  <div className="w-14 h-14 bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl flex items-center justify-center text-3xl border border-slate-700 group-hover:border-emerald-500/50 transition-all">
                    {holding.icon}
                  </div>
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <span className="text-white font-bold text-xl">{holding.symbol}</span>
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-mono font-bold bg-gradient-to-r ${
                          CHAIN_COLORS[holding.chain as keyof typeof CHAIN_COLORS]
                        } text-white shadow-lg`}
                      >
                        {CHAIN_ICONS[holding.chain as keyof typeof CHAIN_ICONS]} {holding.chain.toUpperCase().replace('_', ' ')}
                      </span>
                    </div>
                    <div className="text-slate-400 text-sm">{holding.name}</div>
                  </div>
                </div>

                {/* Balance */}
                <div className="text-right flex-1">
                  <div className="text-white font-mono text-2xl font-bold">
                    {holding.balance}
                  </div>
                  <div className="text-slate-400 text-sm font-mono">
                    ${holding.valueUsd.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </div>
                </div>

                {/* Yield Info */}
                <div className="text-right flex-1">
                  {holding.protocol ? (
                    <>
                      <div className="text-emerald-400 font-mono text-xl font-bold">
                        {holding.apy}% APY
                      </div>
                      <div className="text-slate-400 text-sm font-mono">
                        {holding.protocol}
                      </div>
                    </>
                  ) : (
                    <div className="text-slate-600 font-mono text-sm">
                      No active yield
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-2 flex-1 justify-end">
                  <button className="px-5 py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-lg font-mono text-sm font-bold transition-all shadow-lg hover:shadow-cyan-500/30">
                    SWAP
                  </button>
                  <button className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white rounded-lg font-mono text-sm font-bold transition-all shadow-lg hover:shadow-purple-500/30">
                    FARM
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Chain Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pie Chart Visualization */}
        <div className="bg-slate-900/80 border-2 border-slate-800 rounded-2xl p-8">
          <h3 className="font-mono text-sm text-slate-400 mb-6 uppercase tracking-wider">
            Chain Distribution
          </h3>
          <div className="relative">
            {/* Simple bar chart */}
            <div className="space-y-4">
              {Object.entries(totalByChain).map(([chain, value]) => {
                const percentage = (value / totalValue) * 100
                return (
                  <div key={chain}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-white font-mono text-sm">
                        {CHAIN_ICONS[chain as keyof typeof CHAIN_ICONS]} {chain.toUpperCase().replace('_', ' ')}
                      </span>
                      <span className="text-slate-400 font-mono text-sm">
                        {percentage.toFixed(1)}%
                      </span>
                    </div>
                    <div className="w-full h-3 bg-slate-950 rounded-full overflow-hidden">
                      <div
                        className={`h-full bg-gradient-to-r ${CHAIN_COLORS[chain as keyof typeof CHAIN_COLORS]} rounded-full transition-all duration-500 shadow-lg`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Performance Summary */}
        <div className="bg-slate-900/80 border-2 border-slate-800 rounded-2xl p-8">
          <h3 className="font-mono text-sm text-slate-400 mb-6 uppercase tracking-wider">
            24h Performance
          </h3>
          <div className="space-y-5">
            {[
              { metric: 'Total Gain', value: '+$247.32', change: '+4.1%', positive: true },
              { metric: 'Yield Earned', value: '+$18.64', change: 'Today', positive: true },
              { metric: 'Gas Spent', value: '-$2.47', change: '8 txns', positive: false },
              { metric: 'Net Profit', value: '+$244.85', change: '+4.0%', positive: true },
            ].map((item, i) => (
              <div key={i} className="flex items-center justify-between p-4 bg-slate-950/60 rounded-xl border border-slate-800">
                <div>
                  <div className="text-slate-400 text-sm font-mono mb-1">{item.metric}</div>
                  <div className={`text-2xl font-bold ${item.positive ? 'text-emerald-400' : 'text-orange-400'}`}>
                    {item.value}
                  </div>
                </div>
                <div className="text-right">
                  <div className={`text-lg font-mono ${item.positive ? 'text-emerald-400' : 'text-slate-500'}`}>
                    {item.change}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
