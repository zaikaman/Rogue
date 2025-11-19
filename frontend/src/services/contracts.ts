import { Contract } from 'ethers'
import { getSigner } from './wallet'

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
 * StakingProxy contract ABI
 */
const STAKING_PROXY_ABI = [
  'function stake(address token, uint256 amount, uint8 riskProfile) returns (bytes32)',
  'function unstake(bytes32 positionId) returns (uint256)',
  'function getPosition(bytes32 positionId) view returns (address user, address token, uint256 amount, uint256 depositedAt, uint8 riskProfile, bool active)',
  'function getUserPositions(address user) view returns (bytes32[])',
  'event Staked(bytes32 indexed positionId, address indexed user, address indexed token, uint256 amount, uint8 riskProfile)',
]

/**
 * Contract addresses (Base Mainnet)
 * NOTE: STAKING_PROXY and YIELD_HARVESTER need to be deployed to Base Mainnet first
 * Run: cd contracts && npx hardhat run scripts/deploy.ts --network base
 */
export const CONTRACTS = {
  // TODO: Update these after deploying to Base Mainnet
  STAKING_PROXY: import.meta.env.VITE_STAKING_PROXY_ADDRESS || '0xBe038f9Fa03C127e5E565a77b5b6DD1507B223a1',
  YIELD_HARVESTER: import.meta.env.VITE_YIELD_HARVESTER_ADDRESS || '0xa26A882e63B598B7f4B39C56fB014A7F4398FbFD',
  // Base Mainnet token addresses
  USDC: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',  // Base Mainnet USDC
  WETH: '0x4200000000000000000000000000000000000006',  // Base Mainnet WETH
  CBETH: '0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22', // Base Mainnet cbETH
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
export async function stakeTokens(
  tokenAddress: string, 
  amount: string,
  riskProfile: 'low' | 'medium' | 'high'
) {
  const stakingContract = await getStakingContract()
  const riskMap = { low: 0, medium: 1, high: 2 }
  const tx = await stakingContract.stake(tokenAddress, amount, riskMap[riskProfile])
  return await tx.wait()
}

/**
 * Unstake tokens
 */
export async function unstakeTokens(positionId: string) {
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
