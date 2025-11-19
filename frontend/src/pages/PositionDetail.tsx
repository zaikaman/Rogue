import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api } from '../services/api'
import YieldChart from '../components/YieldChart'
import AllocationSlider from '../components/AllocationSlider'
import APYCard from '../components/APYCard'
import ClaimUnstakeActions from '../components/ClaimUnstakeActions'
import TransactionHistory from '../components/TransactionHistory'
import { HugeiconsIcon } from '@hugeicons/react'
import { Cancel01Icon, ArrowLeft01Icon } from '@hugeicons/core-free-icons'

export default function PositionDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [position, setPosition] = useState<any>(null)
  const [strategies, setStrategies] = useState<any[]>([])
  const [yieldHistory, setYieldHistory] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRebalancing, setIsRebalancing] = useState(false)
  const [estimatedRewards, setEstimatedRewards] = useState('0')

  // Fetch position details
  useEffect(() => {
    if (!id) return

    const fetchData = async () => {
      setIsLoading(true)
      try {
        const [positionData, strategiesData, historyData] = await Promise.all([
          api.getPosition(id),
          api.getStrategies(id),
          api.getYieldHistory(id, 30).catch(() => []) // Fallback to empty if fails
        ])

        setPosition(positionData)
        setStrategies(strategiesData)

        // Calculate estimated rewards
        const daysActive = Math.floor(
          (Date.now() - new Date(positionData.created_at).getTime()) / (1000 * 60 * 60 * 24)
        )
        const rewards = parseFloat(positionData.amount) * daysActive * 0.001
        setEstimatedRewards(rewards.toFixed(4))

        // Use real data if available
        if (historyData && historyData.length > 0) {
          setYieldHistory(historyData)
        } else {
          setYieldHistory([])
        }
      } catch (error) {
        console.error('Failed to fetch position:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [id])

  // Handle claim rewards
  const handleClaim = async () => {
    if (!id) return
    
    try {
      await api.claimRewards(id)
      alert('Rewards claimed successfully!')
      // Refresh position data
      const updatedPosition = await api.getPosition(id)
      setPosition(updatedPosition)
    } catch (error) {
      console.error('Failed to claim rewards:', error)
      alert('Failed to claim rewards. Please try again.')
    }
  }

  // Handle unstake
  const handleUnstake = async () => {
    if (!id) return
    
    try {
      await api.unstakePosition(id)
      alert('Position unstaked successfully! Redirecting to dashboard...')
      setTimeout(() => navigate('/dashboard'), 2000)
    } catch (error) {
      console.error('Failed to unstake:', error)
      alert('Failed to unstake position. Please try again.')
    }
  }

  // Handle allocation update
  const handleAllocationUpdate = async (newAllocations: Record<string, number>) => {
    if (!id) return

    setIsRebalancing(true)
    try {
      await api.updateAllocations(id, newAllocations)

      // Refresh data
      const [updatedPosition, updatedStrategies] = await Promise.all([
        api.getPosition(id),
        api.getStrategies(id)
      ])
      
      setPosition(updatedPosition)
      setStrategies(updatedStrategies)
    } catch (error) {
      console.error('Failed to update allocations:', error)
      alert('Failed to update allocations. Please try again.')
    } finally {
      setIsRebalancing(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="w-12 h-12 border-2 border-teal-glow border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400 font-mono">Loading position...</p>
        </div>
      </div>
    )
  }

  if (!position) {
    return (
      <div className="text-center py-12">
        <div className="text-teal-glow mb-4 flex justify-center">
          <HugeiconsIcon icon={Cancel01Icon} size={64} />
        </div>
        <p className="text-gray-400 mb-2">Position not found</p>
        <a href="/dashboard" className="text-teal-glow hover:text-white font-mono text-sm flex items-center justify-center gap-2">
          <HugeiconsIcon icon={ArrowLeft01Icon} size={16} />
          Back to Dashboard
        </a>
      </div>
    )
  }

  const activeStrategy = strategies.find((s) => s.active)
  const currentAllocations = activeStrategy?.allocation || {
    'Aave V3': 60,
    'Frax Finance': 40
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <a
            href="/dashboard"
            className="text-sm text-gray-500 hover:text-teal-glow font-mono mb-2 inline-flex items-center gap-2"
          >
            <HugeiconsIcon icon={ArrowLeft01Icon} size={16} />
            Back to Dashboard
          </a>
          <h1 className="text-3xl font-bold text-white mb-2 font-mono tracking-tight">
            POSITION DETAILS
          </h1>
          <p className="text-gray-400">
            Position ID: <span className="text-white font-mono">{id?.slice(0, 12)}...</span>
          </p>
        </div>
        <div
          className={`px-4 py-2 rounded-sm font-mono text-sm uppercase ${
            position.status === 'active'
              ? 'bg-success/20 text-success border border-success'
              : 'bg-gray-500/20 text-gray-500 border border-gray-500'
          }`}
        >
          {position.status}
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <APYCard
          title="CURRENT APY"
          value={`${activeStrategy?.expected_apy || '0'}%`}
          change="+2.1%"
          protocol={activeStrategy?.risk_profile || 'Mixed'}
        />
        <APYCard
          title="POSITION VALUE"
          value={`$${parseFloat(position.amount).toFixed(2)}`}
          change="+$47"
          protocol={position.token}
        />
        <APYCard
          title="TOTAL EARNED"
          value="$124.56"
          change="+$12.34"
          protocol="30d"
        />
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Yield Chart */}
        <YieldChart data={yieldHistory} height={400} />

        {/* Allocation Slider */}
        <AllocationSlider
          currentAllocations={currentAllocations}
          onUpdate={handleAllocationUpdate}
          isLoading={isRebalancing}
        />
      </div>

      {/* Claim & Unstake Actions */}
      <ClaimUnstakeActions
        positionId={id || ''}
        onClaim={handleClaim}
        onUnstake={handleUnstake}
        canClaim={position.status === 'active'}
        canUnstake={position.status === 'active'}
        estimatedRewards={estimatedRewards}
      />

      {/* Transaction History */}
      <TransactionHistory
        walletAddress={position.wallet_address}
        positionId={id}
      />

      {/* Position Info */}
      <div className="terminal-border bg-noir-dark/50 rounded-sm p-6 scan-line">
        <h3 className="font-mono text-sm text-gray-400 mb-4 uppercase tracking-wide">
          Position Information
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <div>
            <div className="text-xs text-gray-500 font-mono mb-1">Risk Profile</div>
            <div
              className={`text-white font-bold uppercase ${
                position.risk_profile === 'low'
                  ? 'text-success'
                  : position.risk_profile === 'medium'
                  ? 'text-teal-glow'
                  : 'text-warning'
              }`}
            >
              {position.risk_profile}
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-500 font-mono mb-1">Created</div>
            <div className="text-white font-mono">
              {new Date(position.created_at).toLocaleDateString()}
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-500 font-mono mb-1">Last Updated</div>
            <div className="text-white font-mono">
              {new Date(position.updated_at).toLocaleDateString()}
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-500 font-mono mb-1">Token</div>
            <div className="text-white font-bold">{position.token}</div>
          </div>
        </div>
      </div>

      {/* Strategy Details */}
      {activeStrategy && (
        <div className="terminal-border bg-noir-dark/50 rounded-sm p-6 scan-line">
          <h3 className="font-mono text-sm text-gray-400 mb-4 uppercase tracking-wide">
            Active Strategy
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-400 font-mono">Strategy ID</span>
              <span className="text-white font-mono">{activeStrategy.id.slice(0, 12)}...</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400 font-mono">Expected APY</span>
              <span className="text-teal-glow font-bold font-mono">
                {activeStrategy.expected_apy}%
              </span>
            </div>
            {activeStrategy.rationale && (
              <div>
                <div className="text-gray-400 font-mono mb-2">Rationale</div>
                <p className="text-sm text-white">{activeStrategy.rationale}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
