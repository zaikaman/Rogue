import { useState, useEffect } from 'react'
import { useWallet } from './useWallet'
import { api } from '../services/api'

export interface Position {
  id: string
  wallet_address: string
  token: 'USDC'
  amount: string
  risk_profile: 'low' | 'medium' | 'high'
  status: 'active' | 'paused' | 'closed'
  created_at: string
  updated_at: string
  last_action_at?: string
}

/**
 * Hook to fetch and manage user positions
 */
export function usePosition() {
  const { address, isConnected } = useWallet()
  const [positions, setPositions] = useState<Position[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchPositions = async () => {
    if (!address || !isConnected) {
      setPositions([])
      return
    }

    setLoading(true)
    setError(null)

    try {
      const data = await api.getPositions(address)
      setPositions(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch positions')
      console.error('Error fetching positions:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPositions()
  }, [address, isConnected])

  const createPosition = async (
    token: 'USDC',
    amount: string,
    riskProfile: 'low' | 'medium' | 'high'
  ) => {
    if (!address) throw new Error('Wallet not connected')

    setLoading(true)
    setError(null)

    try {
      const position = await api.createPosition({
        wallet_address: address,
        token,
        amount,
        risk_profile: riskProfile,
      })

      setPositions((prev) => [position, ...prev])
      return position
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create position')
      throw err
    } finally {
      setLoading(false)
    }
  }

  const updatePosition = async (id: string, updates: Partial<Position>) => {
    setLoading(true)
    setError(null)

    try {
      const updated = await api.updatePosition(id, updates)
      setPositions((prev) =>
        prev.map((p) => (p.id === id ? updated : p))
      )
      return updated
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update position')
      throw err
    } finally {
      setLoading(false)
    }
  }

  return {
    positions,
    loading,
    error,
    fetchPositions,
    createPosition,
    updatePosition,
  }
}

export default usePosition
