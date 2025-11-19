import { ethers } from 'ethers';
import { getProvider } from '../utils/rpc';
import logger from '../utils/logger';

/**
 * YieldHarvester contract wrapper
 * Handles deposits, compounds, and withdrawals to DeFi protocols
 */

// Contract address (update after deployment)
const YIELD_HARVESTER_ADDRESS = process.env.YIELD_HARVESTER_ADDRESS || '0x0000000000000000000000000000000000000000';

// ABI - minimal interface for YieldHarvester
const YIELD_HARVESTER_ABI = [
  'function depositToProtocol(bytes32 positionId, string memory protocol, address token, uint256 amount, address user, uint256 estimatedGasCost) external',
  'function compoundYield(bytes32 positionId, string memory protocol, uint256 yieldAmount, address user, uint256 estimatedGasCost) external',
  'function withdrawFromProtocol(bytes32 positionId, string memory protocol, uint256 amount) external',
  'function executeHedge(bytes32 positionId, uint256 amount) external',
  'function claimRewards(bytes32 positionId, address user, uint256 amount) external',
  'function getPositionExecutions(bytes32 positionId) external view returns (uint256[])',
  'function getExecution(uint256 executionId) external view returns (bytes32, string, uint256, uint256, address)',
  'function pause() external',
  'function unpause() external',
  'event Deposited(bytes32 indexed positionId, string indexed protocol, uint256 amount, address indexed executor)',
  'event Compounded(bytes32 indexed positionId, string indexed protocol, uint256 yieldAmount, address indexed executor)',
  'event Withdrawn(bytes32 indexed positionId, string indexed protocol, uint256 amount, address indexed executor)',
  'event RewardsClaimed(bytes32 indexed positionId, address indexed user, uint256 amount)'
];

/**
 * Get YieldHarvester contract instance
 */
export function getYieldHarvesterContract(signer?: ethers.Signer) {
  const provider = signer || getProvider();
  return new ethers.Contract(YIELD_HARVESTER_ADDRESS, YIELD_HARVESTER_ABI, provider);
}

/**
 * Estimate gas cost for a transaction (in wei)
 */
export async function estimateGasCost(gasLimit: number = 200000): Promise<bigint> {
  const provider = getProvider();
  const feeData = await provider.getFeeData();
  const gasPrice = feeData.gasPrice || ethers.parseUnits('0.01', 'gwei'); // Base is very cheap
  return BigInt(gasLimit) * gasPrice;
}

/**
 * Deposit tokens to a DeFi protocol
 */
export async function depositToProtocol(
  signer: ethers.Signer,
  positionId: string,
  protocol: string,
  token: string,
  amount: string,
  userAddress: string
): Promise<string> {
  try {
    const contract = getYieldHarvesterContract(signer);
    const amountWei = ethers.parseUnits(amount, 6);
    
    // Estimate gas cost (Base is very cheap, ~200k gas * 0.01 gwei = ~$0.0002)
    const estimatedGas = await estimateGasCost(200000);

    logger.info('Depositing to protocol', { positionId, protocol, amount, estimatedGas: estimatedGas.toString() });

    const tx = await contract.depositToProtocol(positionId, protocol, token, amountWei, userAddress, estimatedGas);
    const receipt = await tx.wait();

    logger.info('Deposit successful', {
      positionId,
      protocol,
      txHash: receipt.hash
    });

    return receipt.hash;
  } catch (error: any) {
    logger.error('Deposit failed', { error: error.message, positionId, protocol });
    throw error;
  }
}

/**
 * Compound accumulated yield
 */
export async function compoundYield(
  signer: ethers.Signer,
  positionId: string,
  protocol: string,
  yieldAmount: string,
  userAddress: string
): Promise<string> {
  try {
    const contract = getYieldHarvesterContract(signer);
    const amountWei = ethers.parseUnits(yieldAmount, 6);
    
    // Estimate gas cost
    const estimatedGas = await estimateGasCost(150000);

    logger.info('Compounding yield', { positionId, protocol, yieldAmount, estimatedGas: estimatedGas.toString() });

    const tx = await contract.compoundYield(positionId, protocol, amountWei, userAddress, estimatedGas);
    const receipt = await tx.wait();

    logger.info('Compound successful', {
      positionId,
      protocol,
      txHash: receipt.hash
    });

    return receipt.hash;
  } catch (error: any) {
    logger.error('Compound failed', { error: error.message, positionId, protocol });
    throw error;
  }
}

/**
 * Withdraw tokens from protocol
 */
export async function withdrawFromProtocol(
  signer: ethers.Signer,
  positionId: string,
  protocol: string,
  amount: string
): Promise<string> {
  try {
    const contract = getYieldHarvesterContract(signer);
    const amountWei = ethers.parseUnits(amount, 6);

    logger.info('Withdrawing from protocol', { positionId, protocol, amount });

    const tx = await contract.withdrawFromProtocol(positionId, protocol, amountWei);
    const receipt = await tx.wait();

    logger.info('Withdrawal successful', {
      positionId,
      protocol,
      txHash: receipt.hash
    });

    return receipt.hash;
  } catch (error: any) {
    logger.error('Withdrawal failed', { error: error.message, positionId, protocol });
    throw error;
  }
}

/**
 * Execute hedge strategy
 */
export async function executeHedge(
  signer: ethers.Signer,
  positionId: string,
  amount: string
): Promise<string> {
  try {
    const contract = getYieldHarvesterContract(signer);
    const amountWei = ethers.parseUnits(amount, 6);

    logger.info('Executing hedge', { positionId, amount });

    const tx = await contract.executeHedge(positionId, amountWei);
    const receipt = await tx.wait();

    logger.info('Hedge executed', {
      positionId,
      txHash: receipt.hash
    });

    return receipt.hash;
  } catch (error: any) {
    logger.error('Hedge execution failed', { error: error.message, positionId });
    throw error;
  }
}

/**
 * Claim ATP rewards
 */
export async function claimRewards(
  signer: ethers.Signer,
  positionId: string,
  userAddress: string,
  amount: string
): Promise<string> {
  try {
    const contract = getYieldHarvesterContract(signer);
    const amountWei = ethers.parseUnits(amount, 18); // ATP tokens have 18 decimals

    logger.info('Claiming rewards', { positionId, userAddress, amount });

    const tx = await contract.claimRewards(positionId, userAddress, amountWei);
    const receipt = await tx.wait();

    logger.info('Rewards claimed', {
      positionId,
      txHash: receipt.hash
    });

    return receipt.hash;
  } catch (error: any) {
    logger.error('Claim rewards failed', { error: error.message, positionId });
    throw error;
  }
}

/**
 * Get execution history for a position
 */
export async function getPositionExecutions(positionId: string): Promise<number[]> {
  try {
    const contract = getYieldHarvesterContract();
    const executions = await contract.getPositionExecutions(positionId);
    return executions.map((id: bigint) => Number(id));
  } catch (error: any) {
    logger.error('Failed to get position executions', { error: error.message, positionId });
    return [];
  }
}

/**
 * Get execution details
 */
export async function getExecution(executionId: number): Promise<{
  positionId: string;
  action: string;
  amount: string;
  executedAt: number;
  executor: string;
} | null> {
  try {
    const contract = getYieldHarvesterContract();
    const execution = await contract.getExecution(executionId);

    return {
      positionId: execution[0],
      action: execution[1],
      amount: ethers.formatUnits(execution[2], 6),
      executedAt: Number(execution[3]),
      executor: execution[4]
    };
  } catch (error: any) {
    logger.error('Failed to get execution', { error: error.message, executionId });
    return null;
  }
}

/**
 * Pause contract (emergency)
 */
export async function pauseContract(signer: ethers.Signer): Promise<string> {
  try {
    const contract = getYieldHarvesterContract(signer);
    
    logger.warn('Pausing YieldHarvester contract');
    
    const tx = await contract.pause();
    const receipt = await tx.wait();

    logger.info('Contract paused', { txHash: receipt.hash });
    return receipt.hash;
  } catch (error: any) {
    logger.error('Failed to pause contract', { error: error.message });
    throw error;
  }
}

/**
 * Unpause contract
 */
export async function unpauseContract(signer: ethers.Signer): Promise<string> {
  try {
    const contract = getYieldHarvesterContract(signer);
    
    logger.info('Unpausing YieldHarvester contract');
    
    const tx = await contract.unpause();
    const receipt = await tx.wait();

    logger.info('Contract unpaused', { txHash: receipt.hash });
    return receipt.hash;
  } catch (error: any) {
    logger.error('Failed to unpause contract', { error: error.message });
    throw error;
  }
}
