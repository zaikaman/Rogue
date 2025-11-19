import { useState } from 'react'
import { useAccount } from 'wagmi'
import StakeForm from '../components/StakeForm'
import RiskSlider from '../components/RiskSlider'
import { HugeiconsIcon } from '@hugeicons/react'
import { 
  Shield01Icon, 
  ChartLineData01Icon,
  ZapIcon
} from '@hugeicons/core-free-icons'

export default function Stake() {
  const { address: walletAddress } = useAccount()
  const [riskProfile, setRiskProfile] = useState<'low' | 'medium' | 'high'>('medium')

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-white mb-2 font-mono tracking-tight">
          STAKE & DELEGATE
        </h1>
        <p className="text-gray-400">
          Delegate assets to autonomous AI agents for optimized yields
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Stake Form */}
        <div className="lg:col-span-2 space-y-6">
          <StakeForm riskProfile={riskProfile} walletAddress={walletAddress || null} />
          
          {/* Strategy Info */}
          <div className="bg-noir-dark border border-noir-gray/50 p-6 rounded-sm">
            <h3 className="text-lg font-bold text-white mb-4 font-mono flex items-center">
              <HugeiconsIcon icon={ZapIcon} size={20} className="mr-2 text-red-glow" />
              STRATEGY BREAKDOWN
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-noir-gray/30 p-4 rounded-sm">
                <div className="text-gray-400 text-xs font-mono mb-1">YIELD FARMING</div>
                <div className="text-white font-bold text-lg">
                  {riskProfile === 'low' ? '80%' : riskProfile === 'medium' ? '60%' : '40%'}
                </div>
                <div className="text-gray-500 text-xs mt-1">Stablecoin lending & staking</div>
              </div>
              <div className="bg-noir-gray/30 p-4 rounded-sm">
                <div className="text-gray-400 text-xs font-mono mb-1">LIQUIDITY PROVISION</div>
                <div className="text-white font-bold text-lg">
                  {riskProfile === 'low' ? '10%' : riskProfile === 'medium' ? '20%' : '20%'}
                </div>
                <div className="text-gray-500 text-xs mt-1">Curve/Uniswap pools</div>
              </div>
              <div className="bg-noir-gray/30 p-4 rounded-sm">
                <div className="text-gray-400 text-xs font-mono mb-1">ALGO TRADING</div>
                <div className="text-white font-bold text-lg">
                  {riskProfile === 'low' ? '10%' : riskProfile === 'medium' ? '20%' : '40%'}
                </div>
                <div className="text-gray-500 text-xs mt-1">Momentum swaps & arbitrage</div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Risk Profile */}
        <div className="space-y-6">
          <div className="terminal-border bg-noir-dark/50 rounded-sm p-6 scan-line">
            <div className="flex items-center mb-4">
              <HugeiconsIcon icon={Shield01Icon} size={20} className="text-red-glow mr-2" />
              <h3 className="font-mono text-sm text-gray-400 uppercase tracking-wide">
                Risk Profile
              </h3>
            </div>
            
            <RiskSlider value={riskProfile} onChange={setRiskProfile} />
            
            <div className="mt-8 space-y-4">
              <div className="flex justify-between items-center p-3 bg-noir-gray/30 rounded-sm">
                <span className="text-gray-400 text-sm">Target APY</span>
                <span className="text-red-glow font-mono font-bold">
                  {riskProfile === 'low' ? '8-12%' : riskProfile === 'medium' ? '12-18%' : '18-28%'}
                </span>
              </div>
              
              <div className="flex justify-between items-center p-3 bg-noir-gray/30 rounded-sm">
                <span className="text-gray-400 text-sm">Max Drawdown</span>
                <span className="text-warning font-mono font-bold">
                  {riskProfile === 'low' ? '< 2%' : riskProfile === 'medium' ? '< 5%' : '< 12%'}
                </span>
              </div>

              <div className="flex justify-between items-center p-3 bg-noir-gray/30 rounded-sm">
                <span className="text-gray-400 text-sm">Rebalance Freq.</span>
                <span className="text-white font-mono font-bold">
                  {riskProfile === 'low' ? 'Weekly' : riskProfile === 'medium' ? 'Daily' : 'Hourly'}
                </span>
              </div>
            </div>

            <div className="mt-6 p-4 border border-red-glow/20 bg-red-glow/5 rounded-sm">
              <p className="text-xs text-red-glow/80 leading-relaxed">
                <span className="font-bold">AI AGENT NOTE:</span> {
                  riskProfile === 'low' 
                    ? "Prioritizing capital preservation. Focusing on blue-chip lending protocols and stablecoin yields."
                    : riskProfile === 'medium'
                    ? "Balanced approach. Mixing stable yields with opportunistic LP positions and moderate exposure to volatility."
                    : "Aggressive growth strategy. Actively trading volatility and seeking high-yield farms with higher risk tolerance."
                }
              </p>
            </div>
          </div>

          <div className="bg-noir-dark border border-noir-gray/50 p-6 rounded-sm">
            <h3 className="text-sm font-bold text-white mb-4 font-mono flex items-center">
              <HugeiconsIcon icon={ChartLineData01Icon} size={16} className="mr-2 text-gray-400" />
              MARKET CONDITIONS
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Volatility (VIX)</span>
                <span className="text-success font-mono">LOW (14.2)</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Gas Price</span>
                <span className="text-white font-mono">12 Gwei</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Trend</span>
                <span className="text-red-glow font-mono">BULLISH</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}