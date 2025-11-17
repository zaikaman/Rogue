import { useAccount, useConnect, useDisconnect } from 'wagmi'
import { useEffect, useState } from 'react'

/**
 * Custom hook wrapping RainbowKit/wagmi for wallet interactions
 */
export function useWallet() {
  const { address, isConnected, isConnecting } = useAccount()
  const { connect, connectors } = useConnect()
  const { disconnect } = useDisconnect()
  const [chainId, setChainId] = useState<number | undefined>()

  useEffect(() => {
    if (isConnected && address) {
      // Get chain ID from window.ethereum if available
      window.ethereum?.request({ method: 'eth_chainId' })
        .then((chainId: string) => setChainId(parseInt(chainId, 16)))
        .catch(console.error)
    }
  }, [isConnected, address])

  const isPolygonAmoy = chainId === 80002

  return {
    address,
    isConnected,
    isConnecting,
    chainId,
    isPolygonAmoy,
    connect: () => connect({ connector: connectors[0] }),
    disconnect,
  }
}

export default useWallet
