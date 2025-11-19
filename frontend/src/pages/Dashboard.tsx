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

  // Fetch data when wallet is connected
  useEffect(() => {
    if (!isConnected || !walletAddress) {
      setPositions([])
      setTotalEarned('0')
      return
    }

    const fetchData = async () => {
      try {
        const positionsData = await api.getPositions(walletAddress)
        setPositions(positionsData || [])
        
        // Calculate total claimable rewards and earned value (simplified simulation)
        let earnedSum = 0
        
        ;(positionsData || []).forEach((p: any) => {
          const daysActive = Math.floor(
            (Date.now() - new Date(p.created_at).getTime()) / (1000 * 60 * 60 * 24)
          )
          
          // Simulate earned interest based on APY
          const apy = p.strategy?.expectedApy || 0
          const earned = parseFloat(p.amount || '0') * (apy / 100) * (daysActive / 365)
          earnedSum += earned
        })
        
        setTotalEarned(earnedSum.toFixed(2))
      } catch (error) {
        console.error('Failed to fetch dashboard data:', error)
      }
    }

    fetchData()
  }, [walletAddress, isConnected])

  // Calculate aggregate stats
  const totalStaked = positions.reduce((sum, p) => sum + parseFloat(p.amount || '0'), 0)
  
  // Mock data for charts
  const allocationData = [
    { name: 'Yields', value: 60 },
    { name: 'LPs', value: 20 },
    { name: 'Swaps', value: 15 },
    { name: 'Stakes', value: 5 },
  ]

  const pnlData = [
    { name: 'Mon', value: 1000 },
    { name: 'Tue', value: 1020 },
    { name: 'Wed', value: 1015 },
    { name: 'Thu', value: 1040 },
    { name: 'Fri', value: 1080 },
    { name: 'Sat', value: 1090 },
    { name: 'Sun', value: 1120 },
  ]

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
            <div className="p-2 bg-teal-glow/10 rounded-sm">
              <HugeiconsIcon icon={Wallet01Icon} size={24} className="text-teal-glow" />
            </div>
            <span className="text-xs font-mono text-teal-glow">+12.5%</span>
          </div>
          <p className="text-gray-400 text-sm font-mono mb-1">TOTAL VALUE LOCKED</p>
          <h3 className="text-2xl font-bold text-white">${totalStaked.toFixed(2)}</h3>
        </div>

        <div className="bg-noir-dark border border-noir-gray/50 p-6 rounded-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-success/10 rounded-sm">
              <HugeiconsIcon icon={ChartLineData01Icon} size={24} className="text-success" />
            </div>
            <span className="text-xs font-mono text-success">+2.4%</span>
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
            <HugeiconsIcon icon={ArrowUpRight01Icon} size={20} className="mr-2 text-teal-glow" />
            PERFORMANCE
          </h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={pnlData}>
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
        </div>

        {/* Allocation Chart */}
        <div className="bg-noir-dark border border-noir-gray/50 p-6 rounded-sm">
          <h3 className="text-lg font-bold text-white mb-6 font-mono flex items-center">
            <HugeiconsIcon icon={Layers01Icon} size={20} className="mr-2 text-teal-glow" />
            ALLOCATION
          </h3>
          <div className="flex items-center justify-center h-64">
            <ResponsiveContainer width="100%" height="100%">
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
