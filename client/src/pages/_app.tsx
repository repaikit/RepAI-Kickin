import '@rainbow-me/rainbowkit/styles.css';
import { getDefaultConfig, RainbowKitProvider } from '@rainbow-me/rainbowkit';
import { WagmiProvider } from 'wagmi';
import { base } from 'wagmi/chains';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { AppProps } from "next/app";
import "@/index.css";
import { AuthProvider } from '@/contexts/AuthContext';
import AIChatPopup from "@/components/AIChatPopup";
import { useEffect, useState } from "react";

// Use RainbowKit's default config to support all wallets
const config = getDefaultConfig({
  appName: 'Kickin Game',
  projectId: '325fbe143f7ef647abd49c4a299b304a', // TODO: Replace with your real WalletConnect projectId from https://cloud.walletconnect.com/
  chains: [base],
});

// Create React Query client
const queryClient = new QueryClient();

function MyApp({ Component, pageProps }: AppProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (!sessionStorage.getItem('token_cleared')) {
      localStorage.removeItem('access_token');
      sessionStorage.setItem('token_cleared', 'true');
    }
  }, []);

  if (!mounted) {
    return null;
  }

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>
          <TooltipProvider>
            <Toaster position="bottom-right" richColors />
            <AuthProvider>
              <Component {...pageProps} />
              <AIChatPopup />
            </AuthProvider>
          </TooltipProvider>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

export default MyApp; 