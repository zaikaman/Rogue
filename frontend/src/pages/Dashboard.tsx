import { useState, useEffect } from 'react'
import { useAccount } from 'wagmi'
import { api } from '../services/api'
import TransactionHistory from '../components/TransactionHistory'
import { 
  PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area
} from 'recharts'
import { HugeiconsIcon } from '@hugeicons/react'
import { 
  Wallet01Icon, 
  ChartLineData01Icon, 
  Layers01Icon,
  ArrowUpRight01Icon
} from '@hugeicons/core-free-icons'

const COLORS = ['#00D4FF', '#00FF88', '#FFB800', '#FF0055']

export default function Dashboard() {
  const { address: walletAddress, isConnected } = useAccount()
  const [positions, setPositions] = useState<any[]>([])
  const [totalEarned, setTotalEarned] = useState('0')
  const [portfolioHistory, setPortfolioHistory] = useState<any[]>([])
  const [allocationData, setAllocationData] = useState<any[]>([])

  // Fetch data when wallet is connected
  useEffect(() => {
    if (!isConnected || !walletAddress) {
      setPositions([])
      setTotalEarned('0')
      setPortfolioHistory([])
      setAllocationData([])
      return
    }

    const fetchData = async () => {
      try {
        const positionsData = await api.getPositions(walletAddress)
        setPositions(positionsData || [])
        
        // Calculate total earned from all positions
        let earnedSum = 0
        const protocolAllocations: { [key: string]: number } = {}
        
        ;(positionsData || []).forEach((p: any) => {
          const daysActive = Math.floor(
            (Date.now() - new Date(p.created_at).getTime()) / (1000 * 60 * 60 * 24)
          )
          
          // Calculate earned based on APY and time
          const apy = p.strategy?.expected_apy || 0
          const earned = parseFloat(p.amount || '0') * (apy / 100) * (daysActive / 365)
          earnedSum += earned

          // Aggregate protocol allocations
          if (p.allocation && typeof p.allocation === 'object') {
            Object.entries(p.allocation).forEach(([protocol, percentage]: [string, any]) => {
              protocolAllocations[protocol] = (protocolAllocations[protocol] || 0) + parseFloat(percentage || '0')
            })
          }
        })
        
        setTotalEarned(earnedSum.toFixed(2))

        // Convert protocol allocations to chart data
        const allocChartData = Object.entries(protocolAllocations).map(([name, value]) => ({
          name: name.charAt(0).toUpperCase() + name.slice(1),
          value: parseFloat(value.toFixed(2))
        }))
        setAllocationData(allocChartData.length > 0 ? allocChartData : [])

        // Fetch yield history for performance chart
        if (positionsData && positionsData.length > 0) {
          try {
            const histories = await Promise.all(
              positionsData.slice(0, 3).map((p: any) => 
                api.getYieldHistory(p.id, 7).catch(() => [])
              )
            )
            
            // Combine and aggregate by timestamp
            const combinedHistory: { [key: string]: number } = {}
            histories.flat().forEach((entry: any) => {
              const date = new Date(entry.timestamp).toLocaleDateString('en-US', { weekday: 'short' })
              combinedHistory[date] = (combinedHistory[date] || 0) + parseFloat(entry.value || '0')
            })

            const historyData = Object.entries(combinedHistory).map(([name, value]) => ({
              name,
              value: parseFloat(value.toFixed(2))
            }))

            setPortfolioHistory(historyData.length > 0 ? historyData : generateMockHistory(positionsData))
          } catch (error) {
            console.error('Failed to fetch yield history:', error)
            setPortfolioHistory(generateMockHistory(positionsData))
          }
        } else {
          setPortfolioHistory([])
        }
      } catch (error) {
        console.error('Failed to fetch dashboard data:', error)
      }
    }

    fetchData()
  }, [walletAddress, isConnected])

  // Generate mock history based on actual position values
  const generateMockHistory = (positionsData: any[]) => {
    const totalValue = positionsData.reduce((sum, p) => sum + parseFloat(p.amount || '0'), 0)
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    return days.map((day, i) => ({
      name: day,
      value: parseFloat((totalValue * (1 + (i * 0.002))).toFixed(2))
    }))
  }

  // Calculate aggregate stats
  const totalStaked = positions.reduce((sum, p) => sum + parseFloat(p.amount || '0'), 0)
  const avgApy = positions.length > 0 
    ? positions.reduce((sum, p) => sum + parseFloat(p.strategy?.expected_apy || '0'), 0) / positions.length 
    : 0

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-white mb-2 font-mono tracking-tight">
          TERMINAL DASHBOARD
        </h1>
        <p className="text-gray-400">
          Real-time portfolio monitoring and analytics
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-noir-dark border border-noir-gray/50 p-6 rounded-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-red-glow/10 rounded-sm">
              <HugeiconsIcon icon={Wallet01Icon} size={24} className="text-red-glow" />
            </div>
            <span className="text-xs font-mono text-red-glow">
              {avgApy > 0 ? `~${avgApy.toFixed(1)}% APY` : 'N/A'}
            </span>
          </div>
          <p className="text-gray-400 text-sm font-mono mb-1">TOTAL VALUE LOCKED</p>
          <h3 className="text-2xl font-bold text-white">${totalStaked.toFixed(2)}</h3>
        </div>

        <div className="bg-noir-dark border border-noir-gray/50 p-6 rounded-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-success/10 rounded-sm">
              <HugeiconsIcon icon={ChartLineData01Icon} size={24} className="text-success" />
            </div>
            <span className="text-xs font-mono text-success">
              {totalEarned !== '0' && totalStaked > 0 ? `+${((parseFloat(totalEarned) / totalStaked) * 100).toFixed(2)}%` : 'N/A'}
            </span>
          </div>
          <p className="text-gray-400 text-sm font-mono mb-1">TOTAL EARNINGS</p>
          <h3 className="text-2xl font-bold text-white">${totalEarned}</h3>
        </div>

        <div className="bg-noir-dark border border-noir-gray/50 p-6 rounded-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-warning/10 rounded-sm">
              <HugeiconsIcon icon={Layers01Icon} size={24} className="text-warning" />
            </div>
            <span className="text-xs font-mono text-warning">ACTIVE</span>
          </div>
          <p className="text-gray-400 text-sm font-mono mb-1">ACTIVE POSITIONS</p>
          <h3 className="text-2xl font-bold text-white">{positions.length}</h3>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* P&L Chart */}
        <div className="bg-noir-dark border border-noir-gray/50 p-6 rounded-sm">
          <h3 className="text-lg font-bold text-white mb-6 font-mono flex items-center">
            <HugeiconsIcon icon={ArrowUpRight01Icon} size={20} className="mr-2 text-red-glow" />
            PERFORMANCE
          </h3>
          {portfolioHistory.length > 0 ? (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={portfolioHistory}>
                  <defs>
                    <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#00D4FF" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#00D4FF" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis 
                    dataKey="name" 
                    stroke="#3F3F3F" 
                    tick={{fill: '#6B7280', fontSize: 12}}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis 
                    stroke="#3F3F3F"
                    tick={{fill: '#6B7280', fontSize: 12}}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => `$${value}`}
                  />
                  <Tooltip 
                    contentStyle={{backgroundColor: '#1E1E1E', borderColor: '#2D2D2D', color: '#fff'}}
                    itemStyle={{color: '#00D4FF'}}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="value" 
                    stroke="#00D4FF" 
                    fillOpacity={1} 
                    fill="url(#colorValue)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center">
              <p className="text-gray-500 font-mono text-sm">No position data yet. Create a position to see performance.</p>
            </div>
          )}
        </div>

        {/* Allocation Chart */}
        <div className="bg-noir-dark border border-noir-gray/50 p-6 rounded-sm">
          <h3 className="text-lg font-bold text-white mb-6 font-mono flex items-center">
            <HugeiconsIcon icon={Layers01Icon} size={20} className="mr-2 text-red-glow" />
            ALLOCATION
          </h3>
          {allocationData.length > 0 ? (
            <div className="flex items-center justify-center h-64">
              <ResponsiveContainer width="50%" height="100%">
                <PieChart>
                  <Pie
                    data={allocationData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    fill="#8884d8"
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {allocationData.map((_entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{backgroundColor: '#1E1E1E', borderColor: '#2D2D2D', color: '#fff'}}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="ml-8 space-y-2">
                {allocationData.map((entry, index) => (
                  <div key={entry.name} className="flex items-center">
                    <div className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                    <span className="text-gray-400 text-sm font-mono">{entry.name}</span>
                    <span className="text-white text-sm font-mono ml-2">{entry.value}%</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center">
              <p className="text-gray-500 font-mono text-sm">No protocol allocations yet. Positions will auto-allocate soon.</p>
            </div>
          )}
        </div>
      </div>

      {/* Activity Feed */}
      <div className="bg-noir-dark border border-noir-gray/50 p-6 rounded-sm">
        <h3 className="text-lg font-bold text-white mb-6 font-mono">RECENT ACTIVITY</h3>
        <TransactionHistory walletAddress={walletAddress || null} />
      </div>
    </div>
  )
}
