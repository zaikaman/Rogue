import { useState } from 'react'

interface ClaimUnstakeActionsProps {
  positionId: string
  onClaim: () => Promise<void>
  onUnstake: () => Promise<void>
  canClaim: boolean
  canUnstake: boolean
  estimatedRewards?: string
}

export default function ClaimUnstakeActions({
  positionId,
  onClaim,
  onUnstake,
  canClaim = true,
  canUnstake = true,
  estimatedRewards = '0'
}: ClaimUnstakeActionsProps) {
  const [isClaiming, setIsClaiming] = useState(false)
  const [isUnstaking, setIsUnstaking] = useState(false)
  const [showUnstakeConfirm, setShowUnstakeConfirm] = useState(false)

  const handleClaim = async () => {
    setIsClaiming(true)
    try {
      await onClaim()
    } catch (error) {
      console.error('Claim failed:', error)
    } finally {
      setIsClaiming(false)
    }
  }

  const handleUnstake = async () => {
    setIsUnstaking(true)
    try {
      await onUnstake()
      setShowUnstakeConfirm(false)
    } catch (error) {
      console.error('Unstake failed:', error)
    } finally {
      setIsUnstaking(false)
    }
  }

  return (
    <div className="terminal-border bg-noir-dark/50 rounded-sm p-6 scan-line">
      <h3 className="font-mono text-sm text-gray-400 mb-6 uppercase tracking-wide">
        Position Actions
      </h3>

      {/* Claim Rewards */}
      <div className="mb-6 terminal-border bg-noir-gray/30 rounded-sm p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-sm text-gray-400 font-mono mb-1">Claimable Rewards</div>
            <div className="text-2xl text-teal-glow font-bold font-mono">
              {estimatedRewards} ATP
            </div>
          </div>
          <button
            onClick={handleClaim}
            disabled={!canClaim || isClaiming || parseFloat(estimatedRewards) === 0}
            className={`
              px-6 py-3 rounded-sm font-bold text-sm transition-all duration-300
              ${
                canClaim && !isClaiming && parseFloat(estimatedRewards) > 0
                  ? 'bg-gradient-teal text-noir-black hover:glow-teal-intense'
                  : 'bg-noir-gray/50 text-gray-600 cursor-not-allowed'
              }
            `}
          >
            {isClaiming ? (
              <span className="flex items-center space-x-2">
                <div className="w-4 h-4 border-2 border-noir-black border-t-transparent rounded-full animate-spin" />
                <span>CLAIMING...</span>
              </span>
            ) : (
              'CLAIM REWARDS'
            )}
          </button>
        </div>
        <p className="text-xs text-gray-500 font-mono">
          ATP rewards accumulate based on position value and risk tier
        </p>
      </div>

      {/* Unstake */}
      {!showUnstakeConfirm ? (
        <button
          onClick={() => setShowUnstakeConfirm(true)}
          disabled={!canUnstake || isUnstaking}
          className="w-full py-3 terminal-border text-warning hover:bg-warning/10 hover:text-white transition-all rounded-sm font-mono text-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          UNSTAKE POSITION
        </button>
      ) : (
        <div className="terminal-border border-warning bg-warning/10 rounded-sm p-4">
          <div className="flex items-start space-x-2 mb-3">
            <span className="text-warning text-xl">⚠️</span>
            <div>
              <div className="text-warning font-bold font-mono mb-1">Confirm Unstake</div>
              <p className="text-sm text-gray-300">
                This will close your position and withdraw all funds. Pending compound actions will
                be canceled. Are you sure?
              </p>
            </div>
          </div>
          <div className="flex space-x-3">
            <button
              onClick={handleUnstake}
              disabled={isUnstaking}
              className="flex-1 py-3 bg-warning text-noir-black hover:bg-red-500 transition-all rounded-sm font-bold text-sm disabled:opacity-50"
            >
              {isUnstaking ? (
                <span className="flex items-center justify-center space-x-2">
                  <div className="w-4 h-4 border-2 border-noir-black border-t-transparent rounded-full animate-spin" />
                  <span>UNSTAKING...</span>
                </span>
              ) : (
                'YES, UNSTAKE'
              )}
            </button>
            <button
              onClick={() => setShowUnstakeConfirm(false)}
              disabled={isUnstaking}
              className="px-6 py-3 terminal-border text-gray-400 hover:text-white hover:bg-noir-gray/50 transition-all rounded-sm font-mono text-sm"
            >
              CANCEL
            </button>
          </div>
        </div>
      )}

      {/* Info */}
      <div className="mt-4 space-y-2">
        <div className="flex items-start space-x-2 text-xs text-gray-500">
          <span>ℹ️</span>
          <p className="font-mono">
            Unstaking initiates on-chain withdrawal. Funds will be available in your wallet after
            transaction confirmation (typically 2-5 minutes).
          </p>
        </div>
        <div className="flex items-start space-x-2 text-xs text-gray-500">
          <span>ℹ️</span>
          <p className="font-mono">
            A 0.5% withdrawal fee applies to cover gas costs for autonomous operations.
          </p>
        </div>
      </div>
    </div>
  )
}
