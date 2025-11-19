import { useState, useEffect } from 'react'
import { useAccount } from 'wagmi'
import { api } from '../services/api'
import { HugeiconsIcon } from '@hugeicons/react'
import { 
  PolygonIcon, 
  EthereumIcon, 
  DollarCircleIcon, 
  DollarSquareIcon,
  Wallet02Icon,
  ArrowUpRight01Icon, 
  ArrowDownLeft01Icon,
  Coins01Icon,
  ChartLineData01Icon,
  PieChartIcon,
  ArrowRight01Icon
} from '@hugeicons/core-free-icons'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'

interface TokenHolding {
  symbol: string
  name: string
  balance: string
  valueUsd: number
  chain: string
  apy?: number
  protocol?: string
  icon?: any
}

const CHAIN_COLORS = {
  amoy: 'text-purple-400',
  sepolia: 'text-blue-400',
  base_sepolia: 'text-indigo-400'
}

export default function Portfolio() {
  const { address: walletAddress, isConnected } = useAccount()
  const [holdings, setHoldings] = useState<TokenHolding[]>([])
  const [isLoading, setIsLoading] = useState(false)

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
          icon: h.symbol === 'USDC' ? DollarCircleIcon : h.symbol === 'ETH' ? EthereumIcon : h.symbol === 'MATIC' ? PolygonIcon : DollarSquareIcon
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

  const filteredHoldings = holdings.sort((a, b) => b.valueUsd - a.valueUsd)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2 font-mono tracking-tight">
            PORTFOLIO
          </h1>
          <p className="text-gray-400">
            Asset allocation and performance tracking
          </p>
        </div>
        <div className="flex gap-3">
          <button className="px-4 py-2 bg-red-glow/10 text-red-glow border border-red-glow/50 rounded-sm font-mono text-sm hover:bg-red-glow hover:text-noir-black transition-all flex items-center gap-2">
            <HugeiconsIcon icon={ArrowDownLeft01Icon} size={16} />
            DEPOSIT
          </button>
          <button className="px-4 py-2 bg-noir-gray/50 text-white border border-noir-gray rounded-sm font-mono text-sm hover:bg-white hover:text-noir-black transition-all flex items-center gap-2">
            <HugeiconsIcon icon={ArrowUpRight01Icon} size={16} />
            WITHDRAW
          </button>
        </div>
      </div>

      {/* Main Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Total Balance Card */}
        <div className="lg:col-span-2 terminal-border bg-noir-dark/50 rounded-sm p-8 scan-line relative overflow-hidden">
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-red-glow/10 rounded-sm flex items-center justify-center text-red-glow border border-red-glow/30">
                <HugeiconsIcon icon={Wallet02Icon} size={20} />
              </div>
              <div className="text-gray-500 font-mono text-sm uppercase">Total Balance</div>
            </div>
            
            <div className="flex items-baseline gap-4 mb-2">
              <span className="text-5xl font-bold text-white tracking-tight">
                ${totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <span className="text-lg font-mono font-bold text-success">
                +2.45%
              </span>
            </div>
            <div className="text-gray-400 font-mono text-sm">
              +$1,234.56 (24h)
            </div>
          </div>
          
          {/* Background decoration */}
          <div className="absolute right-0 top-0 h-full w-1/3 bg-gradient-to-l from-red-glow/5 to-transparent pointer-events-none" />
        </div>

        {/* Allocation Chart */}
        <div className="terminal-border bg-noir-dark/50 rounded-sm p-6 scan-line flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <HugeiconsIcon icon={PieChartIcon} size={16} className="text-gray-500" />
              <span className="text-gray-500 font-mono text-xs uppercase">Allocation</span>
            </div>
          </div>
          <div className="flex-1 min-h-[160px] relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={Object.entries(totalByChain).map(([chain, value]) => ({ name: chain, value }))}
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={70}
                  paddingAngle={2}
                  dataKey="value"
                  stroke="none"
                >
                  {Object.keys(totalByChain).map((_, index) => (
                    <Cell key={`cell-${index}`} fill={['#00f0ff', '#00b8cc', '#008599', '#005266', '#002933'][index % 5]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0a0a0a', borderColor: '#333', borderRadius: '2px' }}
                  itemStyle={{ color: '#fff', fontFamily: 'monospace' }}
                />
              </PieChart>
            </ResponsiveContainer>
            {/* Center Text */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center">
                <div className="text-xs text-gray-500 font-mono">CHAINS</div>
                <div className="text-lg font-bold text-white">{Object.keys(totalByChain).length}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Assets List */}
      <div className="terminal-border bg-noir-dark/50 rounded-sm overflow-hidden">
        <div className="p-4 border-b border-noir-gray/30 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <HugeiconsIcon icon={Coins01Icon} size={16} className="text-red-glow" />
            <h3 className="text-white font-bold font-mono text-sm">YOUR ASSETS</h3>
          </div>
          <button className="text-xs font-mono text-red-glow hover:text-white transition-colors flex items-center gap-1">
            VIEW HISTORY <HugeiconsIcon icon={ArrowRight01Icon} size={12} />
          </button>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-noir-gray/20 border-b border-noir-gray/30">
                <th className="text-left py-3 px-6 text-xs font-mono text-gray-500 font-normal">ASSET</th>
                <th className="text-right py-3 px-6 text-xs font-mono text-gray-500 font-normal">BALANCE</th>
                <th className="text-right py-3 px-6 text-xs font-mono text-gray-500 font-normal">VALUE</th>
                <th className="text-right py-3 px-6 text-xs font-mono text-gray-500 font-normal">APY</th>
                <th className="text-right py-3 px-6 text-xs font-mono text-gray-500 font-normal">CHAIN</th>
                <th className="text-right py-3 px-6 text-xs font-mono text-gray-500 font-normal">ACTIONS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-noir-gray/30">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-gray-500 font-mono text-sm">
                    Loading assets...
                  </td>
                </tr>
              ) : filteredHoldings.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-gray-500 font-mono text-sm">
                    No assets found
                  </td>
                </tr>
              ) : (
                filteredHoldings.map((asset, index) => (
                  <tr key={index} className="hover:bg-noir-gray/10 transition-colors group">
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-noir-gray/50 rounded-full flex items-center justify-center text-white font-bold text-xs border border-noir-gray">
                          <HugeiconsIcon icon={asset.icon} size={16} />
                        </div>
                        <div>
                          <div className="font-bold text-white text-sm">{asset.symbol}</div>
                          <div className="text-xs text-gray-500 font-mono">{asset.name}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-6 text-right font-mono text-sm text-white">
                      {asset.balance}
                    </td>
                    <td className="py-4 px-6 text-right font-mono text-sm font-bold text-white">
                      ${asset.valueUsd.toLocaleString()}
                    </td>
                    <td className="py-4 px-6 text-right font-mono text-sm">
                      {asset.apy ? (
                        <span className="text-success">{asset.apy}%</span>
                      ) : (
                        <span className="text-gray-600">-</span>
                      )}
                    </td>
                    <td className="py-4 px-6 text-right">
                      <span className={`text-xs font-mono uppercase ${CHAIN_COLORS[asset.chain as keyof typeof CHAIN_COLORS] || 'text-gray-400'}`}>
                        {asset.chain.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button className="p-1.5 hover:bg-red-glow/20 text-red-glow rounded-sm transition-colors" title="Trade">
                          <HugeiconsIcon icon={ChartLineData01Icon} size={16} />
                        </button>
                        <button className="p-1.5 hover:bg-white/20 text-white rounded-sm transition-colors" title="Send">
                          <HugeiconsIcon icon={ArrowUpRight01Icon} size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
