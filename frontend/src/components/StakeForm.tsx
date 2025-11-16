import { useState } from 'react'
import { api } from '../services/api'

interface StakeFormProps {
  riskProfile: 'low' | 'medium' | 'high'
  walletAddress: string | null
}

export default function StakeForm({ riskProfile, walletAddress }: StakeFormProps) {
  const [token, setToken] = useState<'USDC' | 'KRWQ'>('USDC')
  const [amount, setAmount] = useState('')
  const [isStaking, setIsStaking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const handleStake = async () => {
    if (!walletAddress) {
      setError('Please connect your wallet first')
      return
    }

    if (!amount || parseFloat(amount) <= 0) {
      setError('Please enter a valid amount')
      return
    }

    setIsStaking(true)
    setError(null)
    setSuccess(null)

    try {
      // Create position via backend API
      const result = await api.createPosition({
        wallet_address: walletAddress,
        token: token,
        amount: amount,
        risk_profile: riskProfile
      })

      if (result) {
        setSuccess(`Position created! ID: ${result.id}`)
        setAmount('')
        
        // Redirect to dashboard after 2 seconds
        setTimeout(() => {
          window.location.href = '/dashboard'
        }, 2000)
      } else {
        setError('Failed to create position')
      }
    } catch (err: any) {
      setError(err.message || 'Transaction failed')
    } finally {
      setIsStaking(false)
    }
  }

  return (
    <div className="terminal-border bg-noir-dark/50 rounded-sm p-6 scan-line">
      <h3 className="font-mono text-sm text-gray-400 mb-6 uppercase tracking-wide">
        Stake Assets
      </h3>

      {/* Error/Success Messages */}
      {error && (
        <div className="mb-4 terminal-border bg-red-500/10 border-red-500 rounded-sm p-3">
          <p className="text-red-500 text-sm font-mono">{error}</p>
        </div>
      )}
      {success && (
        <div className="mb-4 terminal-border bg-teal-glow/10 border-teal-glow rounded-sm p-3">
          <p className="text-teal-glow text-sm font-mono">{success}</p>
        </div>
      )}

      {/* Token Selection */}
      <div className="mb-6">
        <label className="block text-sm text-gray-400 mb-3 font-mono">SELECT TOKEN</label>
        <div className="grid grid-cols-2 gap-3">
          {['USDC', 'KRWQ'].map((t) => (
            <button
              key={t}
              onClick={() => setToken(t as 'USDC' | 'KRWQ')}
              className={`
                py-4 px-6 rounded-sm font-bold text-lg transition-all duration-300
                ${
                  token === t
                    ? 'bg-gradient-teal text-noir-black glow-teal'
                    : 'terminal-border text-gray-400 hover:text-white hover:bg-noir-gray/50'
                }
              `}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Amount Input */}
      <div className="mb-6">
        <label className="block text-sm text-gray-400 mb-3 font-mono">AMOUNT</label>
        <div className="relative">
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            className="
              w-full bg-noir-gray/50 terminal-border rounded-sm px-6 py-4
              text-white text-2xl font-bold placeholder-gray-600
              focus:outline-none focus:glow-teal transition-all
            "
          />
          <div className="absolute right-4 top-1/2 transform -translate-y-1/2 flex items-center space-x-3">
            <button className="text-teal-glow text-sm font-mono hover:text-white transition-colors">
              MAX
            </button>
            <span className="text-gray-500 font-mono text-lg">{token}</span>
          </div>
        </div>
        
        {/* Balance */}
        <div className="mt-2 flex justify-between text-sm">
          <span className="text-gray-500 font-mono">Balance: 10,000 {token}</span>
          <span className="text-gray-500 font-mono">≈ $10,000 USD</span>
        </div>
      </div>

      {/* Strategy Preview */}
      <div className="mb-6 terminal-border bg-noir-gray/30 rounded-sm p-4 space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-400 font-mono">Est. APY</span>
          <span className="text-teal-glow font-bold font-mono">
            {riskProfile === 'low' ? '10.2%' : riskProfile === 'medium' ? '14.8%' : '22.4%'}
          </span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-400 font-mono">Protocol</span>
          <span className="text-white font-mono">Aave V3</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-400 font-mono">Risk Level</span>
          <span
            className={`font-mono uppercase ${
              riskProfile === 'low' ? 'text-success' :
              riskProfile === 'medium' ? 'text-teal-glow' : 'text-warning'
            }`}
          >
            {riskProfile}
          </span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-400 font-mono">Gas Fee</span>
          <span className="text-white font-mono">~$0.12</span>
        </div>
      </div>

      {/* Stake Button */}
      <button
        onClick={handleStake}
        disabled={!amount || isStaking}
        className={`
          w-full py-4 rounded-sm font-bold text-lg transition-all duration-300
          ${
            !amount || isStaking
              ? 'bg-noir-gray/50 text-gray-600 cursor-not-allowed'
              : 'bg-gradient-teal text-noir-black hover:glow-teal-intense glitch-on-hover'
          }
        `}
      >
        {isStaking ? (
          <span className="flex items-center justify-center space-x-2">
            <div className="w-5 h-5 border-2 border-noir-black border-t-transparent rounded-full animate-spin" />
            <span>EXECUTING...</span>
          </span>
        ) : (
          'STAKE NOW'
        )}
      </button>

      {/* Info */}
      <p className="mt-4 text-xs text-gray-500 text-center font-mono">
        AI agents will autonomously optimize your position 24/7
      </p>
    </div>
  )
}
