import { WagmiConfig, createConfig, http } from 'wagmi';
import { base } from 'wagmi/chains';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { AppProps } from "next/app";
import "@/index.css";
import { AuthProvider } from '@/contexts/AuthContext';
import AIChatPopup from "@/components/AIChatPopup";
import { useEffect, useState } from "react";

// Create wagmi config
const config = createConfig({
  chains: [base],
  transports: {
    [base.id]: http()
  }
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
    <WagmiConfig config={config}>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster position="bottom-right" richColors />
          <AuthProvider>
            <Component {...pageProps} />
            <AIChatPopup />
          </AuthProvider>
        </TooltipProvider>
      </QueryClientProvider>
    </WagmiConfig>
  );
}

export default MyApp; 