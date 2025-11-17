import { BrowserProvider, Contract, JsonRpcSigner } from 'ethers';

/**
 * Get ethers provider from window.ethereum
 */
export async function getProvider(): Promise<BrowserProvider> {
  if (!window.ethereum) {
    throw new Error('No Ethereum wallet found. Please install MetaMask or use RainbowKit.');
  }

  return new BrowserProvider(window.ethereum);
}

/**
 * Get signer for transactions
 */
export async function getSigner(): Promise<JsonRpcSigner> {
  const provider = await getProvider();
  return await provider.getSigner();
}

/**
 * Get connected wallet address
 */
export async function getWalletAddress(): Promise<string> {
  const signer = await getSigner();
  return await signer.getAddress();
}

/**
 * Request wallet connection
 */
export async function connectWallet(): Promise<string> {
  const provider = await getProvider();
  const accounts = await provider.send('eth_requestAccounts', []);
  return accounts[0];
}

/**
 * Sign a message with wallet
 */
export async function signMessage(message: string): Promise<string> {
  const signer = await getSigner();
  return await signer.signMessage(message);
}

/**
 * Create authentication message for backend
 */
export function createAuthMessage(walletAddress: string): string {
  const message = {
    address: walletAddress,
    timestamp: Date.now(),
    purpose: 'Authenticate with Rogue DeFi',
  };
  return JSON.stringify(message, null, 2);
}

/**
 * Get contract instance
 */
export async function getContract(
  address: string,
  abi: any[]
): Promise<Contract> {
  const signer = await getSigner();
  return new Contract(address, abi, signer);
}

/**
 * Wait for transaction confirmation
 */
export async function waitForTransaction(txHash: string, confirmations = 1) {
  const provider = await getProvider();
  const receipt = await provider.waitForTransaction(txHash, confirmations);
  
  if (!receipt) {
    throw new Error('Transaction not found');
  }
  
  if (receipt.status === 0) {
    throw new Error('Transaction failed');
  }
  
  return receipt;
}

/**
 * Format wallet address for display
 */
export function formatAddress(address: string): string {
  if (!address) return '';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

/**
 * Check if connected to Polygon Amoy testnet
 */
export async function isPolygonAmoy(): Promise<boolean> {
  const provider = await getProvider();
  const network = await provider.getNetwork();
  return network.chainId === 80002n;
}

/**
 * Switch to Polygon Amoy testnet
 */
export async function switchToPolygonAmoy(): Promise<void> {
  if (!window.ethereum) {
    throw new Error('No Ethereum wallet found');
  }

  try {
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: '0x13882' }], // 80002 in hex
    });
  } catch (error: any) {
    // Chain not added, add it
    if (error.code === 4902) {
      await window.ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [
          {
            chainId: '0x13882',
            chainName: 'Polygon Amoy Testnet',
            nativeCurrency: {
              name: 'POL',
              symbol: 'POL',
              decimals: 18,
            },
            rpcUrls: ['https://rpc-amoy.polygon.technology'],
            blockExplorerUrls: ['https://amoy.polygonscan.com'],
          },
        ],
      });
    } else {
      throw error;
    }
  }
}

export const wallet = {
  getProvider,
  getSigner,
  getWalletAddress,
  connectWallet,
  signMessage,
  createAuthMessage,
  getContract,
  waitForTransaction,
  formatAddress,
  isPolygonAmoy,
  switchToPolygonAmoy,
};

export default wallet;
