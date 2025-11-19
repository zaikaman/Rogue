import { useState, useEffect } from 'react'
import { api, Transaction } from '../services/api'
import { HugeiconsIcon } from '@hugeicons/react'
import { 
  Coins01Icon, 
  RepeatIcon, 
  GiftIcon, 
  Upload01Icon, 
  BalanceScaleIcon, 
  Note01Icon,
  File01Icon
} from '@hugeicons/core-free-icons'

interface TransactionHistoryProps {
  walletAddress: string | null
  positionId?: string
}

export default function TransactionHistory({ walletAddress, positionId }: TransactionHistoryProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [filter, setFilter] = useState<'all' | 'stake' | 'compound' | 'claim' | 'unstake'>('all')

  useEffect(() => {
    if (!walletAddress) return

    const fetchTransactions = async () => {
      setIsLoading(true)
      try {
        const data = await api.getTransactions(walletAddress)
        
        // Filter by position if specified
        const filtered = positionId
          ? data.filter((tx) => tx.position_id === positionId)
          : data
        
        setTransactions(filtered)
      } catch (error) {
        console.error('Failed to fetch transactions:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchTransactions()
  }, [walletAddress, positionId])

  const filteredTransactions = filter === 'all'
    ? transactions
    : transactions.filter((tx) => tx.type === filter)

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed':
        return 'text-success'
      case 'pending':
        return 'text-warning'
      case 'failed':
        return 'text-red-500'
      default:
        return 'text-gray-400'
    }
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'stake':
        return Coins01Icon
      case 'compound':
        return RepeatIcon
      case 'claim':
        return GiftIcon
      case 'unstake':
        return Upload01Icon
      case 'rebalance':
        return BalanceScaleIcon
      default:
        return Note01Icon
    }
  }

  return (
    <div className="terminal-border bg-noir-dark/50 rounded-sm scan-line">
      <div className="p-6 border-b border-noir-gray/50 flex items-center justify-between">
        <h3 className="font-mono text-sm text-gray-400 uppercase tracking-wide">
          Transaction History
        </h3>

        {/* Filter */}
        <div className="flex items-center space-x-2">
          {['all', 'stake', 'compound', 'claim', 'unstake'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f as any)}
              className={`
                px-3 py-1 rounded-sm text-xs font-mono uppercase transition-all
                ${
                  filter === f
                    ? 'bg-red-glow/20 text-red-glow border border-red-glow'
                    : 'text-gray-500 hover:text-gray-300'
                }
              `}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="p-6">
        {isLoading ? (
          <div className="text-center py-12">
            <div className="w-8 h-8 border-2 border-red-glow border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-gray-400 font-mono">Loading transactions...</p>
          </div>
        ) : filteredTransactions.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-red-glow mb-4 flex justify-center">
              <HugeiconsIcon icon={File01Icon} size={64} />
            </div>
            <p className="text-gray-400 mb-2">No transactions yet</p>
            <p className="text-sm text-gray-500 font-mono">
              Transaction history will appear here after your first action
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredTransactions.map((tx) => (
              <div
                key={tx.id}
                className="terminal-border bg-noir-gray/30 rounded-sm p-4 hover:bg-noir-gray/50 transition-colors"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center space-x-3">
                    <span className="text-red-glow">
                      <HugeiconsIcon icon={getTypeIcon(tx.type)} size={24} />
                    </span>
                    <div>
                      <div className="text-white font-bold uppercase text-sm">{tx.type}</div>
                      <div className="text-xs text-gray-500 font-mono">
                        {new Date(tx.created_at).toLocaleString()}
                      </div>
                    </div>
                  </div>
                  <div
                    className={`text-xs font-mono uppercase px-2 py-1 rounded ${getStatusColor(
                      tx.status
                    )}`}
                  >
                    {tx.status}
                  </div>
                </div>

                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500 font-mono">TX Hash</span>
                    <a
                      href={`https://polygonscan.com/tx/${tx.tx_hash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-red-glow hover:text-white font-mono truncate max-w-[200px]"
                    >
                      {tx.tx_hash.slice(0, 10)}...{tx.tx_hash.slice(-8)}
                    </a>
                  </div>
                  {tx.gas_cost && (
                    <div className="flex justify-between">
                      <span className="text-gray-500 font-mono">Gas Cost</span>
                      <span className="text-white font-mono">${parseFloat(tx.gas_cost).toFixed(4)}</span>
                    </div>
                  )}
                  {tx.notes && (
                    <div className="flex justify-between">
                      <span className="text-gray-500 font-mono">Notes</span>
                      <span className="text-white font-mono text-xs">{tx.notes}</span>
                    </div>
                  )}
                  {tx.confirmed_at && (
                    <div className="flex justify-between">
                      <span className="text-gray-500 font-mono">Confirmed</span>
                      <span className="text-white font-mono text-xs">
                        {new Date(tx.confirmed_at).toLocaleString()}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
