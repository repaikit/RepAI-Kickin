import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { AppProps } from "next/app";
import "@/index.css";
import { PrivyProvider } from '@privy-io/react-auth';
import { AuthProvider } from '@/contexts/AuthContext';

function MyApp({ Component, pageProps }: AppProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <PrivyProvider
          appId="cmankoxe6005kky0m7conxm53"
          config={{
            appearance: {
              theme: 'light',
              accentColor: '#4F46E5',
            }
          }}
        >
          <AuthProvider>
              <Component {...pageProps} />
          </AuthProvider>
        </PrivyProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default MyApp; 