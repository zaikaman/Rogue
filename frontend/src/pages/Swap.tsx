import { useState, useEffect } from 'react'

interface SwapQuote {
  fromToken: string
  toToken: string
  fromAmount: string
  toAmount: string
  estimatedGas: string
  priceImpact: number
  protocols: string[]
}

const SUPPORTED_TOKENS = [
  { symbol: 'ETH', name: 'Ethereum', icon: '⟠' },
  { symbol: 'USDC', name: 'USD Coin', icon: '💵' },
  { symbol: 'MATIC', name: 'Polygon', icon: '⬡' },
  { symbol: 'DAI', name: 'Dai Stablecoin', icon: '◈' },
]

const SUPPORTED_CHAINS = [
  { id: 'amoy', name: 'Polygon Amoy', icon: '⬡' },
  { id: 'sepolia', name: 'Sepolia', icon: '⟠' },
  { id: 'base_sepolia', name: 'Base Sepolia', icon: '🔵' },
]

export default function Swap() {
  const [selectedChain, setSelectedChain] = useState('amoy')
  const [fromToken, setFromToken] = useState('USDC')
  const [toToken, setToToken] = useState('ETH')
  const [amount, setAmount] = useState('')
  const [quote, setQuote] = useState<SwapQuote | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [swapStatus, setSwapStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [txHash, setTxHash] = useState<string>('')

  // Fetch quote when inputs change
  useEffect(() => {
    if (!amount || parseFloat(amount) <= 0) {
      setQuote(null)
      return
    }

    const fetchQuote = async () => {
      setIsLoading(true)
      try {
        const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:4000'}/api/swap/quote?chain=${selectedChain}&fromToken=${fromToken}&toToken=${toToken}&amount=${amount}`)
        const data = await response.json()
        setQuote(data)
      } catch (error) {
        console.error('Failed to fetch quote:', error)
      } finally {
        setIsLoading(false)
      }
    }

    const debounce = setTimeout(fetchQuote, 600)
    return () => clearTimeout(debounce)
  }, [amount, fromToken, toToken, selectedChain])

  const handleSwap = async () => {
    if (!quote) return
    
    setSwapStatus('loading')
    
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:4000'}/api/swap/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chain: selectedChain,
          fromToken,
          toToken,
          amount,
          walletAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1' // TODO: Get from wallet context
        })
      })
      
      const data = await response.json()
      setTxHash(data.txHash)
      setSwapStatus('success')
      
      setTimeout(() => {
        setSwapStatus('idle')
        setAmount('')
        setQuote(null)
      }, 3000)
    } catch (error) {
      console.error('Swap failed:', error)
      setSwapStatus('error')
      setTimeout(() => setSwapStatus('idle'), 3000)
    }
  }

  const swapTokens = () => {
    const temp = fromToken
    setFromToken(toToken)
    setToToken(temp)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-black text-white mb-2 tracking-tighter" style={{ fontFamily: 'Space Grotesk, monospace' }}>
            SWAP TERMINAL
          </h1>
          <p className="text-cyan-400/80 font-mono text-sm">
            Cross-DEX routing powered by 1inch aggregation
          </p>
        </div>
        
        {/* Chain Selector */}
        <div className="flex gap-2">
          {SUPPORTED_CHAINS.map((chain) => (
            <button
              key={chain.id}
              onClick={() => setSelectedChain(chain.id)}
              className={`px-4 py-2 rounded-lg font-mono text-sm transition-all ${
                selectedChain === chain.id
                  ? 'bg-cyan-500/20 text-cyan-400 border-2 border-cyan-500 shadow-[0_0_20px_rgba(34,211,238,0.3)]'
                  : 'bg-slate-900/50 text-slate-500 border-2 border-slate-800 hover:border-slate-700'
              }`}
            >
              <span className="mr-2">{chain.icon}</span>
              {chain.name}
            </button>
          ))}
        </div>
      </div>

      {/* Main Swap Interface */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Swap Card */}
        <div className="lg:col-span-2">
          <div className="relative bg-gradient-to-br from-slate-900 to-slate-950 border-2 border-cyan-500/30 rounded-2xl p-8 shadow-2xl overflow-hidden">
            {/* Animated background */}
            <div className="absolute inset-0 opacity-10">
              <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-cyan-500 to-purple-600 blur-3xl animate-pulse"></div>
            </div>
            
            <div className="relative z-10 space-y-4">
              {/* From Token */}
              <div className="bg-slate-950/80 border border-cyan-500/20 rounded-xl p-5 backdrop-blur-sm">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-slate-400 font-mono text-xs uppercase tracking-wider">From</span>
                  <span className="text-slate-500 font-mono text-xs">Balance: 1,250.00</span>
                </div>
                
                <div className="flex items-center gap-4">
                  <select
                    value={fromToken}
                    onChange={(e) => setFromToken(e.target.value)}
                    className="bg-slate-900 border-2 border-slate-800 text-white px-4 py-3 rounded-lg font-bold text-lg focus:outline-none focus:border-cyan-500 transition-colors min-w-[140px]"
                  >
                    {SUPPORTED_TOKENS.map((token) => (
                      <option key={token.symbol} value={token.symbol}>
                        {token.icon} {token.symbol}
                      </option>
                    ))}
                  </select>
                  
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.0"
                    className="flex-1 bg-transparent text-white text-3xl font-bold outline-none placeholder:text-slate-700"
                  />
                </div>
              </div>

              {/* Swap Direction Button */}
              <div className="flex justify-center -my-2 relative z-20">
                <button
                  onClick={swapTokens}
                  className="bg-gradient-to-br from-cyan-600 to-purple-600 hover:from-cyan-500 hover:to-purple-500 p-3 rounded-full shadow-lg transform hover:scale-110 transition-all duration-200 group"
                >
                  <svg className="w-6 h-6 text-white group-hover:rotate-180 transition-transform duration-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                  </svg>
                </button>
              </div>

              {/* To Token */}
              <div className="bg-slate-950/80 border border-purple-500/20 rounded-xl p-5 backdrop-blur-sm">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-slate-400 font-mono text-xs uppercase tracking-wider">To</span>
                  <span className="text-slate-500 font-mono text-xs">Balance: 0.68</span>
                </div>
                
                <div className="flex items-center gap-4">
                  <select
                    value={toToken}
                    onChange={(e) => setToToken(e.target.value)}
                    className="bg-slate-900 border-2 border-slate-800 text-white px-4 py-3 rounded-lg font-bold text-lg focus:outline-none focus:border-purple-500 transition-colors min-w-[140px]"
                  >
                    {SUPPORTED_TOKENS.filter(t => t.symbol !== fromToken).map((token) => (
                      <option key={token.symbol} value={token.symbol}>
                        {token.icon} {token.symbol}
                      </option>
                    ))}
                  </select>
                  
                  <div className="flex-1 text-3xl font-bold text-white">
                    {isLoading ? (
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
                        <span className="text-slate-600">Calculating...</span>
                      </div>
                    ) : quote ? (
                      <span className="bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
                        {parseFloat(quote.toAmount).toFixed(6)}
                      </span>
                    ) : (
                      <span className="text-slate-700">0.0</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Quote Details */}
              {quote && (
                <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-2 font-mono text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Price Impact</span>
                    <span className={`font-bold ${quote.priceImpact > 1 ? 'text-orange-400' : 'text-green-400'}`}>
                      {quote.priceImpact}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Est. Gas</span>
                    <span className="text-white">{quote.estimatedGas} ETH</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Route</span>
                    <span className="text-cyan-400">{quote.protocols.join(' → ')}</span>
                  </div>
                </div>
              )}

              {/* Swap Button */}
              <button
                onClick={handleSwap}
                disabled={!quote || swapStatus === 'loading'}
                className={`w-full py-4 rounded-xl font-black text-lg transition-all duration-300 ${
                  !quote || swapStatus === 'loading'
                    ? 'bg-slate-800 text-slate-600 cursor-not-allowed'
                    : swapStatus === 'success'
                    ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-[0_0_30px_rgba(34,197,94,0.5)]'
                    : swapStatus === 'error'
                    ? 'bg-gradient-to-r from-red-500 to-rose-500 text-white shadow-[0_0_30px_rgba(239,68,68,0.5)]'
                    : 'bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-400 hover:to-purple-400 text-white shadow-[0_0_30px_rgba(34,211,238,0.3)] hover:shadow-[0_0_40px_rgba(34,211,238,0.5)] transform hover:scale-[1.02]'
                }`}
              >
                {swapStatus === 'loading' ? (
                  <span className="flex items-center justify-center gap-3">
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    EXECUTING SWAP...
                  </span>
                ) : swapStatus === 'success' ? (
                  '✓ SWAP SUCCESSFUL'
                ) : swapStatus === 'error' ? (
                  '✗ SWAP FAILED'
                ) : (
                  'EXECUTE SWAP'
                )}
              </button>

              {/* Transaction Hash */}
              {txHash && (
                <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3 font-mono text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-green-400">Transaction Hash:</span>
                    <span className="text-green-300">{txHash.slice(0, 10)}...{txHash.slice(-8)}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Info Panel */}
        <div className="space-y-6">
          {/* Market Stats */}
          <div className="bg-slate-900/80 border-2 border-slate-800 rounded-xl p-6">
            <h3 className="font-mono text-sm text-slate-400 mb-4 uppercase tracking-wider">
              Market Stats
            </h3>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-slate-500 text-xs font-mono">ETH/USD</span>
                  <span className="text-green-400 text-xs font-mono">+2.3%</span>
                </div>
                <div className="text-white text-xl font-bold">$1,847.32</div>
              </div>
              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-slate-500 text-xs font-mono">MATIC/USD</span>
                  <span className="text-red-400 text-xs font-mono">-0.8%</span>
                </div>
                <div className="text-white text-xl font-bold">$0.87</div>
              </div>
              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-slate-500 text-xs font-mono">Gas Price</span>
                  <span className="text-yellow-400 text-xs font-mono">Medium</span>
                </div>
                <div className="text-white text-xl font-bold">28 Gwei</div>
              </div>
            </div>
          </div>

          {/* Recent Swaps */}
          <div className="bg-slate-900/80 border-2 border-slate-800 rounded-xl p-6">
            <h3 className="font-mono text-sm text-slate-400 mb-4 uppercase tracking-wider">
              Recent Activity
            </h3>
            <div className="space-y-3">
              {[
                { from: 'USDC', to: 'ETH', amount: '500', time: '2m ago' },
                { from: 'ETH', to: 'MATIC', amount: '0.25', time: '18m ago' },
                { from: 'DAI', to: 'USDC', amount: '1000', time: '1h ago' },
              ].map((swap, i) => (
                <div key={i} className="flex items-center justify-between p-3 bg-slate-950/50 rounded-lg border border-slate-800">
                  <div className="flex items-center gap-2">
                    <span className="text-white font-mono text-sm">{swap.from}</span>
                    <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                    </svg>
                    <span className="text-cyan-400 font-mono text-sm">{swap.to}</span>
                  </div>
                  <span className="text-slate-500 font-mono text-xs">{swap.time}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Protocol Info */}
      <div className="bg-gradient-to-r from-slate-900/50 to-slate-950/50 border border-slate-800 rounded-xl p-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-gradient-to-br from-cyan-500 to-purple-500 rounded-full flex items-center justify-center text-2xl flex-shrink-0">
            ⚡
          </div>
          <div>
            <h3 className="text-white font-bold text-lg mb-2">Intelligent Swap Routing</h3>
            <p className="text-slate-400 text-sm leading-relaxed">
              Rogue automatically finds the best rates across Uniswap, SushiSwap, and other DEXs using 1inch aggregation. 
              Get optimal pricing with minimal slippage and gas costs.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
