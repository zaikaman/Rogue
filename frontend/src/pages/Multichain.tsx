import { useState, useEffect } from 'react'
import { api } from '../services/api'

interface YieldOpportunity {
  protocol: string
  chain: string
  asset: string
  apy: number
  tvl: string
  risk: 'low' | 'medium' | 'high'
  type: 'yield' | 'lp' | 'stake'
}

const CHAIN_INFO = {
  amoy: { name: 'Polygon Amoy', icon: '⬡', color: 'from-purple-500 to-violet-600', textColor: 'text-purple-400' },
  sepolia: { name: 'Ethereum Sepolia', icon: '⟠', color: 'from-blue-500 to-cyan-600', textColor: 'text-blue-400' },
  base_sepolia: { name: 'Base Sepolia', icon: '🔵', color: 'from-indigo-500 to-blue-600', textColor: 'text-indigo-400' }
}

const RISK_COLORS = {
  low: 'from-green-500 to-emerald-600',
  medium: 'from-yellow-500 to-orange-600',
  high: 'from-red-500 to-rose-600'
}

export default function Multichain() {
  const [opportunities, setOpportunities] = useState<YieldOpportunity[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [selectedChain, setSelectedChain] = useState<string>('all')
  const [selectedRisk, setSelectedRisk] = useState<string>('all')
  const [sortBy, setSortBy] = useState<'apy' | 'tvl'>('apy')
  const [autoOptimize, setAutoOptimize] = useState(true)

  useEffect(() => {
    const fetchOpportunities = async () => {
      setIsLoading(true)
      try {
        const data = await api.getMultichainOpportunities()
        setOpportunities(data)
      } catch (error) {
        console.error('Failed to fetch opportunities:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchOpportunities()
  }, [])

  const filteredOpps = opportunities
    .filter(opp => selectedChain === 'all' || opp.chain === selectedChain)
    .filter(opp => selectedRisk === 'all' || opp.risk === selectedRisk)
    .sort((a, b) => {
      if (sortBy === 'apy') return b.apy - a.apy
      return parseFloat(b.tvl.replace(/[$M|B]/g, '')) - parseFloat(a.tvl.replace(/[$M|B]/g, ''))
    })

  const bestAPY = filteredOpps[0]
  const totalChains = new Set(opportunities.map(o => o.chain)).size
  const avgAPY = opportunities.length > 0 
    ? opportunities.reduce((sum, o) => sum + o.apy, 0) / opportunities.length
    : 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="relative">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-6xl font-black mb-3 tracking-tighter">
              <span className="bg-gradient-to-r from-violet-400 via-fuchsia-400 to-cyan-400 bg-clip-text text-transparent">
                MULTICHAIN
              </span>
              <br />
              <span className="text-white">YIELD OPTIMIZER</span>
            </h1>
            <p className="text-slate-400 font-mono text-sm max-w-2xl">
              Autonomous cross-chain yield farming • Powered by LayerZero bridging • Real-time APY monitoring
            </p>
          </div>

          {/* Auto-Optimize Toggle */}
          <div className="bg-slate-900/80 border-2 border-slate-800 rounded-2xl p-6">
            <div className="flex items-center gap-4">
              <div>
                <div className="text-slate-400 font-mono text-xs uppercase mb-1">Auto Optimization</div>
                <div className="text-white font-bold text-lg">
                  {autoOptimize ? '✓ ENABLED' : '✗ DISABLED'}
                </div>
              </div>
              <button
                onClick={() => setAutoOptimize(!autoOptimize)}
                className={`relative w-16 h-8 rounded-full transition-all ${
                  autoOptimize ? 'bg-gradient-to-r from-emerald-500 to-cyan-500' : 'bg-slate-700'
                }`}
              >
                <div
                  className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full shadow-lg transition-transform ${
                    autoOptimize ? 'transform translate-x-8' : ''
                  }`}
                />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
        <div className="relative bg-gradient-to-br from-violet-600 to-fuchsia-600 rounded-2xl p-6 overflow-hidden shadow-2xl">
          <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent"></div>
          <div className="relative z-10">
            <div className="text-white/80 font-mono text-xs uppercase mb-2">Best APY Available</div>
            <div className="text-5xl font-black text-white mb-1">{bestAPY?.apy}%</div>
            <div className="text-white/90 font-mono text-sm">{bestAPY?.protocol} • {bestAPY?.asset}</div>
          </div>
        </div>

        <div className="bg-slate-900/80 border-2 border-cyan-500/30 rounded-2xl p-6 hover:border-cyan-500/60 transition-all">
          <div className="text-slate-400 font-mono text-xs uppercase mb-2">Total Chains</div>
          <div className="text-5xl font-black text-white mb-1">{totalChains}</div>
          <div className="text-cyan-400 font-mono text-sm">Cross-chain enabled</div>
        </div>

        <div className="bg-slate-900/80 border-2 border-purple-500/30 rounded-2xl p-6 hover:border-purple-500/60 transition-all">
          <div className="text-slate-400 font-mono text-xs uppercase mb-2">Opportunities</div>
          <div className="text-5xl font-black text-white mb-1">{filteredOpps.length}</div>
          <div className="text-purple-400 font-mono text-sm">Active protocols</div>
        </div>

        <div className="bg-slate-900/80 border-2 border-orange-500/30 rounded-2xl p-6 hover:border-orange-500/60 transition-all">
          <div className="text-slate-400 font-mono text-xs uppercase mb-2">Avg APY</div>
          <div className="text-5xl font-black text-white mb-1">{avgAPY.toFixed(1)}%</div>
          <div className="text-orange-400 font-mono text-sm">Across all chains</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 items-center">
        <div className="flex gap-2">
          <span className="text-slate-400 font-mono text-sm self-center">CHAIN:</span>
          {['all', ...Object.keys(CHAIN_INFO)].map((chain) => (
            <button
              key={chain}
              onClick={() => setSelectedChain(chain)}
              className={`px-5 py-2.5 rounded-xl font-mono text-sm font-bold transition-all ${
                selectedChain === chain
                  ? chain === 'all'
                    ? 'bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white shadow-lg shadow-violet-500/30'
                    : `bg-gradient-to-r ${CHAIN_INFO[chain as keyof typeof CHAIN_INFO].color} text-white shadow-lg`
                  : 'bg-slate-900/80 text-slate-400 border border-slate-800 hover:border-slate-700'
              }`}
            >
              {chain === 'all' ? 'ALL' : `${CHAIN_INFO[chain as keyof typeof CHAIN_INFO].icon} ${CHAIN_INFO[chain as keyof typeof CHAIN_INFO].name.split(' ')[0].toUpperCase()}`}
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <span className="text-slate-400 font-mono text-sm self-center">RISK:</span>
          {['all', 'low', 'medium', 'high'].map((risk) => (
            <button
              key={risk}
              onClick={() => setSelectedRisk(risk)}
              className={`px-4 py-2.5 rounded-xl font-mono text-xs font-bold uppercase transition-all ${
                selectedRisk === risk
                  ? risk === 'all'
                    ? 'bg-gradient-to-r from-slate-600 to-slate-700 text-white'
                    : `bg-gradient-to-r ${RISK_COLORS[risk as keyof typeof RISK_COLORS]} text-white shadow-lg`
                  : 'bg-slate-900/80 text-slate-400 border border-slate-800 hover:border-slate-700'
              }`}
            >
              {risk}
            </button>
          ))}
        </div>

        <div className="ml-auto flex gap-2">
          <button
            onClick={() => setSortBy('apy')}
            className={`px-4 py-2 rounded-lg font-mono text-xs transition-all ${
              sortBy === 'apy'
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            SORT BY APY
          </button>
          <button
            onClick={() => setSortBy('tvl')}
            className={`px-4 py-2 rounded-lg font-mono text-xs transition-all ${
              sortBy === 'tvl'
                ? 'bg-purple-500/20 text-purple-400 border border-purple-500/50'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            SORT BY TVL
          </button>
        </div>
      </div>

      {/* Opportunities Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {isLoading ? (
          <div className="col-span-full text-center py-12 text-gray-400">Loading opportunities...</div>
        ) : filteredOpps.length === 0 ? (
          <div className="col-span-full text-center py-12 text-gray-400">No opportunities found</div>
        ) : (
          filteredOpps.map((opp, index) => {
          const chainInfo = CHAIN_INFO[opp.chain as keyof typeof CHAIN_INFO]
          return (
            <div
              key={index}
              className="relative bg-gradient-to-br from-slate-900 to-slate-950 border-2 border-slate-800 rounded-2xl p-6 hover:border-violet-500/50 transition-all duration-300 group overflow-hidden"
            >
              {/* Glow Effect */}
              <div className={`absolute inset-0 bg-gradient-to-br ${chainInfo.color} opacity-0 group-hover:opacity-10 transition-opacity`}></div>
              
              <div className="relative z-10">
                {/* Header */}
                <div className="flex items-start justify-between mb-5">
                  <div className="flex items-center gap-3">
                    <div className={`w-14 h-14 bg-gradient-to-br ${chainInfo.color} rounded-xl flex items-center justify-center text-3xl shadow-lg`}>
                      {chainInfo.icon}
                    </div>
                    <div>
                      <div className="text-white font-bold text-xl">{opp.protocol}</div>
                      <div className="text-slate-400 text-sm font-mono">{chainInfo.name}</div>
                    </div>
                  </div>
                  
                  <div className={`px-4 py-2 rounded-full bg-gradient-to-r ${RISK_COLORS[opp.risk]} text-white text-xs font-mono font-bold uppercase shadow-lg`}>
                    {opp.risk} RISK
                  </div>
                </div>

                {/* APY Display */}
                <div className="mb-5">
                  <div className="text-slate-400 font-mono text-xs uppercase mb-2">Annual Percentage Yield</div>
                  <div className="text-6xl font-black bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
                    {opp.apy}%
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-4 mb-5">
                  <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4">
                    <div className="text-slate-500 font-mono text-xs mb-1">Asset</div>
                    <div className="text-white font-bold text-lg">{opp.asset}</div>
                  </div>
                  <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4">
                    <div className="text-slate-500 font-mono text-xs mb-1">TVL</div>
                    <div className="text-white font-bold text-lg">{opp.tvl}</div>
                  </div>
                  <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4">
                    <div className="text-slate-500 font-mono text-xs mb-1">Type</div>
                    <div className="text-white font-bold text-lg uppercase">{opp.type}</div>
                  </div>
                  <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4">
                    <div className="text-slate-500 font-mono text-xs mb-1">Daily</div>
                    <div className="text-emerald-400 font-bold text-lg">{(opp.apy / 365).toFixed(2)}%</div>
                  </div>
                </div>

                {/* Action Button */}
                <button className={`w-full py-4 rounded-xl font-black text-lg bg-gradient-to-r ${chainInfo.color} text-white hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg hover:shadow-2xl`}>
                  FARM ON {chainInfo.name.split(' ')[0].toUpperCase()}
                </button>
              </div>
            </div>
          )
        }))}
      </div>

      {/* Auto-Optimization Info */}
      {autoOptimize && (
        <div className="bg-gradient-to-r from-violet-900/40 to-fuchsia-900/40 border-2 border-violet-500/30 rounded-2xl p-8">
          <div className="flex items-start gap-5">
            <div className="w-16 h-16 bg-gradient-to-br from-violet-500 to-fuchsia-500 rounded-2xl flex items-center justify-center text-4xl flex-shrink-0 shadow-lg shadow-violet-500/50">
              🤖
            </div>
            <div className="flex-1">
              <h3 className="text-white font-black text-2xl mb-3">Auto-Optimization Active</h3>
              <p className="text-violet-200 text-sm leading-relaxed mb-4">
                Rogue's AI agents are continuously monitoring all {totalChains} chains for the best yield opportunities. 
                When a better APY is detected (&gt;2% improvement after gas), your position will automatically rebalance across chains via LayerZero bridge.
              </p>
              <div className="flex gap-3">
                <div className="px-4 py-2 bg-violet-500/20 border border-violet-500/30 rounded-lg">
                  <span className="text-violet-300 font-mono text-xs">Last Check: 2 min ago</span>
                </div>
                <div className="px-4 py-2 bg-violet-500/20 border border-violet-500/30 rounded-lg">
                  <span className="text-violet-300 font-mono text-xs">Next Rebalance: ~4h</span>
                </div>
                <div className="px-4 py-2 bg-emerald-500/20 border border-emerald-500/30 rounded-lg">
                  <span className="text-emerald-300 font-mono text-xs">Status: Monitoring</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
