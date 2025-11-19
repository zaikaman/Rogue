import { useState, useEffect } from 'react'
import { api } from '../services/api'
import { HugeiconsIcon } from '@hugeicons/react'
import { 
  PolygonIcon, 
  EthereumIcon, 
  CoinbaseIcon, 
  CheckmarkCircle01Icon, 
  Cancel01Icon,
  BotIcon,
  ArrowRight01Icon
} from '@hugeicons/core-free-icons'

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
  amoy: { name: 'Polygon Amoy', icon: PolygonIcon },
  sepolia: { name: 'Ethereum Sepolia', icon: EthereumIcon },
  base_sepolia: { name: 'Base Sepolia', icon: CoinbaseIcon }
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2 font-mono tracking-tight">
            MULTICHAIN YIELDS
          </h1>
          <p className="text-gray-400">
            Autonomous cross-chain yield farming powered by LayerZero
          </p>
        </div>

        {/* Auto-Optimize Toggle */}
        <div className="terminal-border bg-noir-dark/50 rounded-sm p-4 flex items-center gap-4">
          <div>
            <div className="text-gray-500 font-mono text-xs uppercase mb-1">Auto Optimization</div>
            <div className="text-white font-bold text-sm flex items-center gap-2">
              {autoOptimize ? (
                <>
                  <HugeiconsIcon icon={CheckmarkCircle01Icon} size={16} className="text-success" />
                  <span>ENABLED</span>
                </>
              ) : (
                <>
                  <HugeiconsIcon icon={Cancel01Icon} size={16} className="text-gray-500" />
                  <span>DISABLED</span>
                </>
              )}
            </div>
          </div>
          <button
            onClick={() => setAutoOptimize(!autoOptimize)}
            className={`relative w-12 h-6 rounded-full transition-all ${
              autoOptimize ? 'bg-teal-glow' : 'bg-noir-gray'
            }`}
          >
            <div
              className={`absolute top-1 w-4 h-4 bg-noir-black rounded-full transition-all ${
                autoOptimize ? 'right-1' : 'left-1'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="terminal-border bg-noir-dark/50 rounded-sm p-6 scan-line">
          <div className="text-gray-500 font-mono text-xs uppercase mb-2">Best APY Available</div>
          <div className="text-3xl font-bold text-teal-glow mb-1">{bestAPY?.apy}%</div>
          <div className="text-white font-mono text-xs flex items-center gap-2">
            {bestAPY?.protocol} 
            <span className="text-gray-600">|</span>
            {bestAPY?.asset}
          </div>
        </div>

        <div className="terminal-border bg-noir-dark/50 rounded-sm p-6 scan-line">
          <div className="text-gray-500 font-mono text-xs uppercase mb-2">Total Chains</div>
          <div className="text-3xl font-bold text-white mb-1">{totalChains}</div>
          <div className="text-gray-400 font-mono text-xs">Cross-chain enabled</div>
        </div>

        <div className="terminal-border bg-noir-dark/50 rounded-sm p-6 scan-line">
          <div className="text-gray-500 font-mono text-xs uppercase mb-2">Opportunities</div>
          <div className="text-3xl font-bold text-white mb-1">{filteredOpps.length}</div>
          <div className="text-gray-400 font-mono text-xs">Active protocols</div>
        </div>

        <div className="terminal-border bg-noir-dark/50 rounded-sm p-6 scan-line">
          <div className="text-gray-500 font-mono text-xs uppercase mb-2">Avg APY</div>
          <div className="text-3xl font-bold text-white mb-1">{avgAPY.toFixed(1)}%</div>
          <div className="text-gray-400 font-mono text-xs">Across all chains</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 items-center bg-noir-dark/30 p-4 rounded-sm border border-noir-gray/30">
        <div className="flex gap-2 items-center">
          <span className="text-gray-500 font-mono text-xs mr-2">CHAIN:</span>
          {['all', ...Object.keys(CHAIN_INFO)].map((chain) => (
            <button
              key={chain}
              onClick={() => setSelectedChain(chain)}
              className={`px-3 py-1.5 rounded-sm font-mono text-xs transition-all ${
                selectedChain === chain
                  ? 'bg-teal-glow/20 text-teal-glow border border-teal-glow/50'
                  : 'text-gray-400 hover:text-white hover:bg-noir-gray/50'
              }`}
            >
              {chain === 'all' ? 'ALL' : CHAIN_INFO[chain as keyof typeof CHAIN_INFO].name.split(' ')[0].toUpperCase()}
            </button>
          ))}
        </div>

        <div className="w-px h-6 bg-noir-gray/50 mx-2"></div>

        <div className="flex gap-2 items-center">
          <span className="text-gray-500 font-mono text-xs mr-2">RISK:</span>
          {['all', 'low', 'medium', 'high'].map((risk) => (
            <button
              key={risk}
              onClick={() => setSelectedRisk(risk)}
              className={`px-3 py-1.5 rounded-sm font-mono text-xs uppercase transition-all ${
                selectedRisk === risk
                  ? 'bg-teal-glow/20 text-teal-glow border border-teal-glow/50'
                  : 'text-gray-400 hover:text-white hover:bg-noir-gray/50'
              }`}
            >
              {risk}
            </button>
          ))}
        </div>

        <div className="ml-auto flex gap-2">
          <button
            onClick={() => setSortBy('apy')}
            className={`px-3 py-1.5 rounded-sm font-mono text-xs transition-all ${
              sortBy === 'apy'
                ? 'text-teal-glow'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            SORT: APY
          </button>
          <button
            onClick={() => setSortBy('tvl')}
            className={`px-3 py-1.5 rounded-sm font-mono text-xs transition-all ${
              sortBy === 'tvl'
                ? 'text-teal-glow'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            SORT: TVL
          </button>
        </div>
      </div>

      {/* Opportunities Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {isLoading ? (
          <div className="col-span-full text-center py-12">
            <div className="w-8 h-8 border-2 border-teal-glow border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-gray-400 font-mono">Scanning networks...</p>
          </div>
        ) : filteredOpps.length === 0 ? (
          <div className="col-span-full text-center py-12 text-gray-400 font-mono">No opportunities found matching criteria</div>
        ) : (
          filteredOpps.map((opp, index) => {
          const chainInfo = CHAIN_INFO[opp.chain as keyof typeof CHAIN_INFO]
          return (
            <div
              key={index}
              className="terminal-border bg-noir-dark/50 rounded-sm p-6 hover:bg-noir-gray/20 transition-all duration-300 group"
            >
              <div className="flex items-start justify-between mb-6">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-noir-gray/50 rounded-sm flex items-center justify-center text-white border border-noir-gray">
                    <HugeiconsIcon icon={chainInfo.icon} size={20} />
                  </div>
                  <div>
                    <div className="text-white font-bold text-lg tracking-tight">{opp.protocol}</div>
                    <div className="text-gray-500 text-xs font-mono">{chainInfo.name}</div>
                  </div>
                </div>
                
                <div className={`px-2 py-1 rounded-sm text-xs font-mono font-bold uppercase border ${
                  opp.risk === 'low' ? 'border-success/30 text-success bg-success/10' :
                  opp.risk === 'medium' ? 'border-warning/30 text-warning bg-warning/10' :
                  'border-danger/30 text-danger bg-danger/10'
                }`}>
                  {opp.risk} RISK
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6 mb-6">
                <div>
                  <div className="text-gray-500 font-mono text-xs uppercase mb-1">APY</div>
                  <div className="text-3xl font-bold text-teal-glow">{opp.apy}%</div>
                </div>
                <div>
                  <div className="text-gray-500 font-mono text-xs uppercase mb-1">Asset</div>
                  <div className="text-xl font-bold text-white">{opp.asset}</div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 mb-6 p-3 bg-noir-gray/30 rounded-sm border border-noir-gray/30">
                <div>
                  <div className="text-gray-500 font-mono text-[10px] mb-1">TVL</div>
                  <div className="text-white font-mono text-sm">{opp.tvl}</div>
                </div>
                <div>
                  <div className="text-gray-500 font-mono text-[10px] mb-1">TYPE</div>
                  <div className="text-white font-mono text-sm uppercase">{opp.type}</div>
                </div>
                <div>
                  <div className="text-gray-500 font-mono text-[10px] mb-1">DAILY</div>
                  <div className="text-success font-mono text-sm">{(opp.apy / 365).toFixed(2)}%</div>
                </div>
              </div>

              <button className="w-full py-3 rounded-sm font-mono text-sm font-bold bg-teal-glow/10 text-teal-glow border border-teal-glow/50 hover:bg-teal-glow hover:text-noir-black transition-all flex items-center justify-center gap-2 group-hover:glow-teal">
                DEPLOY AGENT <HugeiconsIcon icon={ArrowRight01Icon} size={16} />
              </button>
            </div>
          )
        }))}
      </div>

      {/* Auto-Optimization Info */}
      {autoOptimize && (
        <div className="terminal-border bg-noir-dark/50 rounded-sm p-6 scan-line flex items-start gap-4">
          <div className="w-10 h-10 bg-teal-glow/10 rounded-sm flex items-center justify-center text-teal-glow flex-shrink-0 border border-teal-glow/30">
            <HugeiconsIcon icon={BotIcon} size={20} />
          </div>
          <div className="flex-1">
            <h3 className="text-white font-bold text-sm mb-2 font-mono">AUTO-OPTIMIZATION ACTIVE</h3>
            <p className="text-gray-400 text-sm leading-relaxed mb-4">
              Rogue's AI agents are continuously monitoring all {totalChains} chains. 
              Positions will automatically rebalance when &gt;2% APY improvement is detected.
            </p>
            <div className="flex gap-3">
              <div className="px-3 py-1 bg-noir-gray/50 rounded-sm border border-noir-gray">
                <span className="text-gray-400 font-mono text-xs">Last Scan: 2m ago</span>
              </div>
              <div className="px-3 py-1 bg-noir-gray/50 rounded-sm border border-noir-gray">
                <span className="text-gray-400 font-mono text-xs">Next Rebalance: ~4h</span>
              </div>
              <div className="px-3 py-1 bg-success/10 rounded-sm border border-success/30">
                <span className="text-success font-mono text-xs">Status: Monitoring</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
