import { useState, useEffect } from 'react'
import { api } from '../services/api'
import { CONTRACTS, approveToken, stakeTokens, getAllowance, getTokenBalance } from '../services/contracts'
import { parseUnits, formatUnits } from 'ethers'
import { HugeiconsIcon } from '@hugeicons/react'
import { ApproximatelyEqualIcon } from '@hugeicons/core-free-icons'
import { useAccount, useSwitchChain } from 'wagmi'

interface StakeFormProps {
  riskProfile: 'low' | 'medium' | 'high'
  walletAddress: string | null
}

export default function StakeForm({ riskProfile, walletAddress }: StakeFormProps) {
  const token = 'USDC' as const
  const [amount, setAmount] = useState('')
  const [isStaking, setIsStaking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [balance, setBalance] = useState('0')
  const { chainId } = useAccount()
  const { switchChain } = useSwitchChain()
  
  const BASE_MAINNET_CHAIN_ID = 8453
  const isCorrectNetwork = chainId === BASE_MAINNET_CHAIN_ID

  // Fetch USDC balance
  useEffect(() => {
    if (walletAddress) {
      getTokenBalance(CONTRACTS.USDC, walletAddress)
        .then(bal => setBalance(formatUnits(bal, 6)))
        .catch(() => setBalance('0'))
    }
  }, [walletAddress])

  const handleSwitchNetwork = async () => {
    try {
      await switchChain({ chainId: BASE_MAINNET_CHAIN_ID })
    } catch (err) {
      console.error('Failed to switch network:', err)
      setError('Failed to switch network. Please switch manually to Base Mainnet.')
    }
  }

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
      // Convert amount to wei (USDC has 6 decimals)
      const amountWei = parseUnits(amount, 6)
      
      // Step 1: Check allowance
      setSuccess('Checking token allowance...')
      const allowance = await getAllowance(
        CONTRACTS.USDC,
        walletAddress,
        CONTRACTS.STAKING_PROXY
      )

      // Step 2: Approve if needed
      if (BigInt(allowance) < amountWei) {
        setSuccess('Approving USDC... Check your wallet')
        await approveToken(CONTRACTS.USDC, CONTRACTS.STAKING_PROXY, amountWei.toString())
        setSuccess('Approval confirmed!')
      }

      // Step 3: Execute stake transaction
      setSuccess('Staking tokens... Check your wallet')
      const receipt = await stakeTokens(CONTRACTS.USDC, amountWei.toString(), riskProfile)
      
      // Step 4: Create position in backend
      setSuccess('Recording position...')
      const result = await api.createPosition({
        wallet_address: walletAddress,
        token: token,
        amount: amount,
        risk_profile: riskProfile,
        tx_hash: receipt.hash
      })

      if (result) {
        setSuccess(`🎉 Position created! Redirecting...`)
        setAmount('')
        
        // Redirect to dashboard after 2 seconds
        setTimeout(() => {
          window.location.href = '/app'
        }, 2000)
      } else {
        setError('Failed to record position in database')
      }
    } catch (err: any) {
      console.error('Stake error:', err)
      if (err.code === 'ACTION_REJECTED') {
        setError('Transaction rejected by user')
      } else if (err.message?.includes('insufficient funds')) {
        setError('Insufficient funds for transaction')
      } else {
        setError(err.message || 'Transaction failed')
      }
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
        <div className="mb-4 terminal-border bg-red-glow/10 border-red-glow rounded-sm p-3">
          <p className="text-red-glow text-sm font-mono">{success}</p>
        </div>
      )}

      {/* Token Display */}
      <div className="mb-6">
        <label className="block text-sm text-gray-400 mb-3 font-mono">TOKEN</label>
        <div className="py-4 px-6 rounded-sm font-bold text-lg bg-gradient-red text-noir-black glow-red">
          USDC
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
              focus:outline-none focus:glow-red transition-all
            "
          />
          <div className="absolute right-4 top-1/2 transform -translate-y-1/2 flex items-center space-x-3">
            <button className="text-red-glow text-sm font-mono hover:text-white transition-colors">
              MAX
            </button>
            <span className="text-gray-500 font-mono text-lg">{token}</span>
          </div>
        </div>
        
        {/* Balance */}
        <div className="mt-2 flex justify-between text-sm">
          <span className="text-gray-500 font-mono">Balance: {parseFloat(balance).toFixed(2)} {token}</span>
          <span className="text-gray-500 font-mono flex items-center gap-1">
            <HugeiconsIcon icon={ApproximatelyEqualIcon} size={14} /> ${parseFloat(balance).toFixed(2)} USD
          </span>
        </div>
      </div>

      {/* Strategy Preview */}
      <div className="mb-6 terminal-border bg-noir-gray/30 rounded-sm p-4 space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-400 font-mono">Est. APY</span>
          <span className="text-red-glow font-bold font-mono">
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
              riskProfile === 'medium' ? 'text-red-glow' : 'text-warning'
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
      {!isCorrectNetwork ? (
        <button
          onClick={handleSwitchNetwork}
          className="w-full py-4 rounded-sm font-bold text-lg transition-all duration-300 bg-warning/80 text-noir-black hover:bg-warning"
        >
          SWITCH TO BASE MAINNET
        </button>
      ) : (
        <button
          onClick={handleStake}
          disabled={!amount || isStaking || parseFloat(amount) > parseFloat(balance)}
          className={`
            w-full py-4 rounded-sm font-bold text-lg transition-all duration-300
            ${
              !amount || isStaking || parseFloat(amount) > parseFloat(balance)
                ? 'bg-noir-gray/50 text-gray-600 cursor-not-allowed'
                : 'bg-gradient-red text-noir-black hover:glow-red-intense glitch-on-hover'
            }
          `}
        >
          {isStaking ? (
            <span className="flex items-center justify-center space-x-2">
              <div className="w-5 h-5 border-2 border-noir-black border-t-transparent rounded-full animate-spin" />
              <span>EXECUTING...</span>
            </span>
          ) : parseFloat(amount) > parseFloat(balance) ? (
            'INSUFFICIENT BALANCE'
          ) : (
            'STAKE NOW'
          )}
        </button>
      )}

      {/* Info */}
      <p className="mt-4 text-xs text-gray-500 text-center font-mono">
        AI agents will autonomously optimize your position 24/7
      </p>
    </div>
  )
}
