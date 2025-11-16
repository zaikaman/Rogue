import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000'

const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

/**
 * Position API
 */
export interface CreatePositionPayload {
  wallet_address: string
  token: 'USDC' | 'KRWQ'
  amount: string
  risk_profile: 'low' | 'medium' | 'high'
}

export interface Position {
  id: string
  wallet_address: string
  token: 'USDC' | 'KRWQ'
  amount: string
  risk_profile: 'low' | 'medium' | 'high'
  status: 'active' | 'paused' | 'closed'
  created_at: string
  updated_at: string
  last_action_at?: string
}

async function createPosition(payload: CreatePositionPayload): Promise<Position> {
  const { data } = await apiClient.post('/api/positions', payload)
  return data
}

async function getPositions(walletAddress: string): Promise<Position[]> {
  const { data } = await apiClient.get(`/api/positions/${walletAddress}`)
  return data
}

async function getPosition(id: string): Promise<Position> {
  const { data } = await apiClient.get(`/api/positions/id/${id}`)
  return data
}

async function updatePosition(id: string, updates: Partial<Position>): Promise<Position> {
  const { data } = await apiClient.patch(`/api/positions/${id}`, updates)
  return data
}

/**
 * Health check
 */
async function healthCheck(): Promise<{ status: string; timestamp: string }> {
  const { data } = await apiClient.get('/health')
  return data
}

/**
 * Strategies API
 */
export interface Strategy {
  id: string
  position_id: string
  risk_profile: 'low' | 'medium' | 'high'
  allocation: Record<string, number>
  expected_apy: string
  rationale?: string
  created_at: string
  active: boolean
}

async function getStrategies(positionId: string): Promise<Strategy[]> {
  const { data } = await apiClient.get(`/api/strategies/${positionId}`)
  return data
}

/**
 * Transactions API
 */
export interface Transaction {
  id: string
  position_id: string
  wallet_address: string
  tx_hash: string
  type: 'stake' | 'unstake' | 'compound' | 'claim' | 'rebalance'
  status: 'pending' | 'confirmed' | 'failed'
  gas_cost?: string
  notes?: string
  created_at: string
  confirmed_at?: string
}

async function getTransactions(walletAddress: string): Promise<Transaction[]> {
  const { data } = await apiClient.get(`/api/transactions/${walletAddress}`)
  return data.data || []
}

/**
 * Yield History API
 */
export interface YieldDataPoint {
  timestamp: string
  apy: number
  value: number
}

async function getYieldHistory(positionId: string, days: number = 30): Promise<YieldDataPoint[]> {
  const { data } = await apiClient.get(`/api/positions/${positionId}/yield-history?days=${days}`)
  return data
}

async function updateAllocations(positionId: string, allocations: Record<string, number>): Promise<any> {
  const { data } = await apiClient.patch(`/api/positions/${positionId}/allocations`, { allocations })
  return data
}

/**
 * Claim and Unstake API
 */
async function claimRewards(positionId: string): Promise<any> {
  const { data } = await apiClient.post(`/api/positions/${positionId}/claim`)
  return data
}

async function unstakePosition(positionId: string): Promise<any> {
  const { data } = await apiClient.post(`/api/positions/${positionId}/unstake`)
  return data
}

/**
 * Export API client
 */
export const api = {
  createPosition,
  getPositions,
  getPosition,
  updatePosition,
  healthCheck,
  getStrategies,
  getTransactions,
  getYieldHistory,
  updateAllocations,
  claimRewards,
  unstakePosition,
}

export default api
