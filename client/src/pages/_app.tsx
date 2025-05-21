import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { AppProps } from "next/app";
import "@/index.css";
import { PrivyProvider } from '@privy-io/react-auth';
import { AuthProvider } from '@/contexts/AuthContext';
import { PageProvider } from '@/contexts/PageContext';
import AIChatPopup from "@/components/AIChatPopup";
import Dashboard from "./Dashboard";
import Profile from "./profile";
// import Matches from "./matches";
// import Players from "./players";
// import Statistics from "./statistics";

function MyApp({ Component, pageProps }: AppProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster position="bottom-right" richColors />
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
            <PageProvider>
              <Component {...pageProps} />
              <AIChatPopup />
            </PageProvider>
          </AuthProvider>
        </PrivyProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default MyApp; 