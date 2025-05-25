import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { AppProps } from "next/app";
import "@/index.css";
import { AuthProvider } from '@/contexts/AuthContext';
import AIChatPopup from "@/components/AIChatPopup";
import { useEffect } from "react";

function MyApp({ Component, pageProps }: AppProps) {
  useEffect(() => {
    if (!sessionStorage.getItem('token_cleared')) {
      localStorage.removeItem('access_token');
      sessionStorage.setItem('token_cleared', 'true');
    }
  }, []);
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster position="bottom-right" richColors />
          <AuthProvider>
              <Component {...pageProps} />
              <AIChatPopup />
          </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default MyApp; 