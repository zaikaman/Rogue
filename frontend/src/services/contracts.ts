import { Contract, BrowserProvider } from 'ethers'
import { getProvider, getSigner } from './wallet'

/**
 * ERC-20 ABI (minimal for balance and approve)
 */
const ERC20_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)',
]

/**
 * StakingProxy contract ABI (placeholder - will be updated when contract is deployed)
 */
const STAKING_PROXY_ABI = [
  'function stake(address token, uint256 amount) returns (bool)',
  'function unstake(uint256 positionId) returns (bool)',
  'function getPosition(uint256 positionId) view returns (tuple(address user, address token, uint256 amount, uint256 timestamp))',
  'function getUserPositions(address user) view returns (uint256[])',
]

/**
 * Contract addresses (to be updated after deployment)
 */
export const CONTRACTS = {
  STAKING_PROXY: '0x0000000000000000000000000000000000000000',
  YIELD_HARVESTER: '0x0000000000000000000000000000000000000000',
  USDC: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
  WMATIC: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
}

/**
 * Get ERC-20 token contract
 */
export async function getTokenContract(tokenAddress: string) {
  const signer = await getSigner()
  return new Contract(tokenAddress, ERC20_ABI, signer)
}

/**
 * Get StakingProxy contract
 */
export async function getStakingContract() {
  const signer = await getSigner()
  return new Contract(CONTRACTS.STAKING_PROXY, STAKING_PROXY_ABI, signer)
}

/**
 * Check token balance
 */
export async function getTokenBalance(tokenAddress: string, walletAddress: string): Promise<string> {
  const contract = await getTokenContract(tokenAddress)
  const balance = await contract.balanceOf(walletAddress)
  return balance.toString()
}

/**
 * Approve token spending
 */
export async function approveToken(tokenAddress: string, spenderAddress: string, amount: string) {
  const contract = await getTokenContract(tokenAddress)
  const tx = await contract.approve(spenderAddress, amount)
  return await tx.wait()
}

/**
 * Check token allowance
 */
export async function getAllowance(
  tokenAddress: string,
  ownerAddress: string,
  spenderAddress: string
): Promise<string> {
  const contract = await getTokenContract(tokenAddress)
  const allowance = await contract.allowance(ownerAddress, spenderAddress)
  return allowance.toString()
}

/**
 * Stake tokens
 */
export async function stakeTokens(tokenAddress: string, amount: string) {
  const stakingContract = await getStakingContract()
  const tx = await stakingContract.stake(tokenAddress, amount)
  return await tx.wait()
}

/**
 * Unstake tokens
 */
export async function unstakeTokens(positionId: number) {
  const stakingContract = await getStakingContract()
  const tx = await stakingContract.unstake(positionId)
  return await tx.wait()
}

/**
 * Get user positions from contract
 */
export async function getUserPositions(walletAddress: string): Promise<number[]> {
  const stakingContract = await getStakingContract()
  const positions = await stakingContract.getUserPositions(walletAddress)
  return positions.map((p: bigint) => Number(p))
}

export const contracts = {
  getTokenContract,
  getStakingContract,
  getTokenBalance,
  approveToken,
  getAllowance,
  stakeTokens,
  unstakeTokens,
  getUserPositions,
  CONTRACTS,
}

export default contracts
