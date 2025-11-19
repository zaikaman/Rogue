import { ethers } from 'ethers';
import { getProvider } from '../utils/rpc';
import logger from '../utils/logger';

/**
 * StakingProxy contract wrapper
 * Handles staking and unstaking operations
 */

// Contract address (update after deployment)
const STAKING_PROXY_ADDRESS = process.env.STAKING_PROXY_ADDRESS || '0x0000000000000000000000000000000000000000';

// ABI - minimal interface for StakingProxy
const STAKING_PROXY_ABI = [
  'function stake(address token, uint256 amount, uint8 riskProfile) external returns (bytes32)',
  'function unstake(bytes32 positionId, uint256 unstakeFee) external returns (uint256)',
  'function depositFeeBalance() external payable',
  'function withdrawFeeBalance(uint256 amount) external',
  'function getFeeBalance(address user) external view returns (uint256)',
  'function getPosition(bytes32 positionId) external view returns (address user, address token, uint256 amount, uint256 depositedAt, uint8 riskProfile, bool active)',
  'function getUserPositions(address user) external view returns (bytes32[])',
  'function isPositionActive(bytes32 positionId) external view returns (bool)',
  'function getTotalStaked(address token) external view returns (uint256)',
  'event Staked(bytes32 indexed positionId, address indexed user, address indexed token, uint256 amount, uint8 riskProfile)',
  'event Unstaked(bytes32 indexed positionId, address indexed user, uint256 amount, uint256 fee)',
  'event FeeDeposited(address indexed user, uint256 amount)',
  'event FeeWithdrawn(address indexed user, uint256 amount)'
];

/**
 * Get StakingProxy contract instance
 */
export function getStakingProxyContract(signer?: ethers.Signer) {
  const provider = signer || getProvider();
  return new ethers.Contract(STAKING_PROXY_ADDRESS, STAKING_PROXY_ABI, provider);
}

/**
 * Stake tokens to create a position
 */
export async function stakeTokens(
  signer: ethers.Signer,
  token: string,
  amount: string,
  riskProfile: 'low' | 'medium' | 'high'
): Promise<{ positionId: string; txHash: string }> {
  try {
    const contract = getStakingProxyContract(signer);
    
    // Map risk profile to uint8
    const riskProfileMap = { low: 0, medium: 1, high: 2 };
    const riskValue = riskProfileMap[riskProfile];

    // Parse amount to wei
    const amountWei = ethers.parseUnits(amount, 6); // USDC has 6 decimals

    logger.info('Staking tokens', { token, amount, riskProfile });

    // Execute stake transaction
    const tx = await contract.stake(token, amountWei, riskValue);
    const receipt = await tx.wait();

    // Parse event to get position ID
    const stakedEvent = receipt.logs.find((log: any) => {
      try {
        const parsed = contract.interface.parseLog(log);
        return parsed?.name === 'Staked';
      } catch {
        return false;
      }
    });

    let positionId = '';
    if (stakedEvent) {
      const parsed = contract.interface.parseLog(stakedEvent);
      positionId = parsed?.args.positionId;
    }

    logger.info('Stake successful', {
      positionId,
      txHash: receipt.hash,
      token,
      amount
    });

    return {
      positionId,
      txHash: receipt.hash
    };
  } catch (error: any) {
    logger.error('Stake failed', { error: error.message, token, amount });
    throw error;
  }
}

/**
 * Unstake tokens from a position
 */
export async function unstakeTokens(
  signer: ethers.Signer,
  positionId: string
): Promise<{ amount: string; txHash: string }> {
  try {
    const contract = getStakingProxyContract(signer);

    // Estimate gas cost for unstake (~100k gas)
    const provider = signer.provider;
    if (!provider) throw new Error('Provider not available');
    const feeData = await provider.getFeeData();
    const gasPrice = feeData.gasPrice || ethers.parseUnits('0.01', 'gwei');
    const estimatedGas = BigInt(100000) * gasPrice;

    logger.info('Unstaking position', { positionId, unstakeFee: estimatedGas.toString() });

    // Execute unstake transaction with fee parameter
    const tx = await contract.unstake(positionId, estimatedGas);
    const receipt = await tx.wait();

    // Parse event to get amount
    const unstakedEvent = receipt.logs.find((log: any) => {
      try {
        const parsed = contract.interface.parseLog(log);
        return parsed?.name === 'Unstaked';
      } catch {
        return false;
      }
    });

    let amount = '0';
    if (unstakedEvent) {
      const parsed = contract.interface.parseLog(unstakedEvent);
      amount = ethers.formatUnits(parsed?.args.amount, 6);
    }

    logger.info('Unstake successful', {
      positionId,
      txHash: receipt.hash,
      amount
    });

    return {
      amount,
      txHash: receipt.hash
    };
  } catch (error: any) {
    logger.error('Unstake failed', { error: error.message, positionId });
    throw error;
  }
}

/**
 * Get position details
 */
export async function getPosition(positionId: string): Promise<{
  user: string;
  token: string;
  amount: string;
  depositedAt: number;
  riskProfile: 'low' | 'medium' | 'high';
  active: boolean;
} | null> {
  try {
    const contract = getStakingProxyContract();
    const position = await contract.getPosition(positionId);

    const riskProfileMap = ['low', 'medium', 'high'] as const;

    return {
      user: position.user,
      token: position.token,
      amount: ethers.formatUnits(position.stakedAmount, 6),
      depositedAt: Number(position.depositedAt),
      riskProfile: riskProfileMap[position.riskProfile],
      active: position.active
    };
  } catch (error: any) {
    logger.error('Failed to get position', { error: error.message, positionId });
    return null;
  }
}

/**
 * Get all user positions
 */
export async function getUserPositions(userAddress: string): Promise<string[]> {
  try {
    const contract = getStakingProxyContract();
    const positions = await contract.getUserPositions(userAddress);
    return positions;
  } catch (error: any) {
    logger.error('Failed to get user positions', { error: error.message, userAddress });
    return [];
  }
}

/**
 * Check if position is active
 */
export async function isPositionActive(positionId: string): Promise<boolean> {
  try {
    const contract = getStakingProxyContract();
    return await contract.isPositionActive(positionId);
  } catch (error: any) {
    logger.error('Failed to check position status', { error: error.message, positionId });
    return false;
  }
}

/**
 * Get total staked amount for a token
 */
export async function getTotalStaked(token: string): Promise<string> {
  try {
    const contract = getStakingProxyContract();
    const total = await contract.getTotalStaked(token);
    return ethers.formatUnits(total, 6);
  } catch (error: any) {
    logger.error('Failed to get total staked', { error: error.message, token });
    return '0';
  }
}

/**
 * Get user's fee balance
 */
export async function getFeeBalance(userAddress: string): Promise<string> {
  try {
    const contract = getStakingProxyContract();
    const balance = await contract.getFeeBalance(userAddress);
    return ethers.formatEther(balance); // Fee balance is in ETH
  } catch (error: any) {
    logger.error('Failed to get fee balance', { error: error.message, userAddress });
    return '0';
  }
}

/**
 * Deposit ETH to cover gas fees
 */
export async function depositFeeBalance(
  signer: ethers.Signer,
  amount: string
): Promise<string> {
  try {
    const contract = getStakingProxyContract(signer);
    const amountWei = ethers.parseEther(amount);

    logger.info('Depositing fee balance', { amount });

    const tx = await contract.depositFeeBalance({ value: amountWei });
    const receipt = await tx.wait();

    logger.info('Fee deposit successful', { txHash: receipt.hash, amount });
    return receipt.hash;
  } catch (error: any) {
    logger.error('Fee deposit failed', { error: error.message, amount });
    throw error;
  }
}

/**
 * Withdraw unused fee balance
 */
export async function withdrawFeeBalance(
  signer: ethers.Signer,
  amount: string
): Promise<string> {
  try {
    const contract = getStakingProxyContract(signer);
    const amountWei = ethers.parseEther(amount);

    logger.info('Withdrawing fee balance', { amount });

    const tx = await contract.withdrawFeeBalance(amountWei);
    const receipt = await tx.wait();

    logger.info('Fee withdrawal successful', { txHash: receipt.hash, amount });
    return receipt.hash;
  } catch (error: any) {
    logger.error('Fee withdrawal failed', { error: error.message, amount });
    throw error;
  }
}
