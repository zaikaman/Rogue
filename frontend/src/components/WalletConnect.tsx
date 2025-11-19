import '@rainbow-me/rainbowkit/styles.css';
import { ConnectButton, RainbowKitProvider, getDefaultConfig } from '@rainbow-me/rainbowkit';
import { WagmiProvider } from 'wagmi';
import { polygonAmoy } from 'wagmi/chains';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient();

const config = getDefaultConfig({
  appName: 'Rogue DeFi Yield Optimizer',
  projectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || 'YOUR_PROJECT_ID',
  chains: [polygonAmoy],
  ssr: false,
});

export function WalletProvider({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>{children}</RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

export function WalletConnect() {
  return (
    <div className="flex items-center justify-end">
      <ConnectButton />
    </div>
  );
}

export default WalletConnect;
