import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Twitter, Check, X as XIcon } from 'lucide-react';
import { API_ENDPOINTS, defaultFetchOptions } from '@/config/api';
import { toast } from "sonner";
import { useAuth } from '@/contexts/AuthContext';

// Mock props and context for demo
interface XConnectionProps {
  userId: string;
}

function hasXConnectedQuery() {
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).get('x_connected') === 'true';
}

export default function XConnection({ userId }: XConnectionProps) {
  const { user, checkAuth } = useAuth();
  const isConnectedFromAuth = !!user?.x_connected && !!user?.x_id && !!user?.x_username;
  const xUsernameFromAuth = user?.x_username || null;

  const [isConnected, setIsConnected] = useState(isConnectedFromAuth);
  const [isLoading, setIsLoading] = useState(false);
  const [xUsername, setXUsername] = useState<string | null>(xUsernameFromAuth);

  // Fallback: check status from API if AuthContext doesn't have it
  const checkConnectionStatus = async () => {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) return;
      const response = await fetch(API_ENDPOINTS.x.status, {
        ...defaultFetchOptions,
        headers: {
          ...defaultFetchOptions.headers,
          'Authorization': `Bearer ${token}`
        }
      });
      if (!response.ok) throw new Error('Failed to check X connection status');
      const data = await response.json();
      setIsConnected(data.is_connected);
      setXUsername(data.username);
    } catch (error) {
      setIsConnected(false);
      setXUsername(null);
    }
  };

  // Connect to X
  const handleXConnect = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem('access_token');
      if (!token) {
        toast.error('Please log in to connect your X account.');
        setIsLoading(false);
        return;
      }
      const response = await fetch(API_ENDPOINTS.x.connect, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to initiate X connection.');
      }
      const data = await response.json();
      window.location.href = data.auth_url;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to connect to X.');
    } finally {
      setIsLoading(false);
    }
  };

  // Disconnect X
  const handleXDisconnect = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem('access_token');
      if (!token) {
        toast.error('Please log in.');
        setIsLoading(false);
        return;
      }
      const response = await fetch(API_ENDPOINTS.x.disconnect, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to disconnect X.');
      }
      toast.success('Disconnected from X successfully!');
      setIsConnected(false);
      setXUsername(null);
      if (checkAuth) await checkAuth();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to disconnect X.');
    } finally {
      setIsLoading(false);
    }
  };

  // When user changes, prefer AuthContext, fallback to API
  useEffect(() => {
    if (isConnectedFromAuth && xUsernameFromAuth) {
      setIsConnected(true);
      setXUsername(xUsernameFromAuth);
      setIsLoading(false);
    } else {
      checkConnectionStatus();
    }
    // eslint-disable-next-line
  }, [user]);

  useEffect(() => {
    if (hasXConnectedQuery()) {
      checkConnectionStatus();
      if (typeof window !== 'undefined') {
        const url = new URL(window.location.href);
        url.searchParams.delete('x_connected');
        window.history.replaceState({}, document.title, url.pathname + url.search);
      }
    }
  }, []);

  return (
    <div className="w-full flex justify-center">
      <Card className="w-full bg-white border border-gray-200 text-gray-900 shadow-2xl rounded-2xl overflow-hidden">
        <CardHeader className="pb-2 bg-black">
          <CardTitle className="flex items-center justify-between text-white">
            <div className="flex items-center space-x-3">
              <span className="text-xl font-bold">X Account</span>
            </div>
            {isConnected && (
              <div className="flex items-center space-x-1 bg-green-500 px-3 py-1 rounded-full text-xs">
                <Check className="w-4 h-4" />
                <span>Connected</span>
              </div>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="py-10 px-12">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-16 space-y-4">
              <div className="relative">
                <div className="animate-spin rounded-full h-12 w-12 border-2 border-gray-300 border-t-black"></div>
              </div>
              <p className="text-gray-500 text-lg">Processing...</p>
            </div>
          ) : isConnected ? (
            <div className="flex flex-col lg:flex-row items-center lg:items-stretch lg:space-x-12 space-y-8 lg:space-y-0 w-full">
              <div className="flex items-center space-x-6 p-8 bg-[#f5f8fa] rounded-xl border border-gray-200 flex-1 min-w-0">
                <div className="flex-1 min-w-0">
                  <p className="text-gray-900 font-semibold text-2xl truncate">@{xUsername}</p>
                  <p className="text-gray-500 text-lg mt-2">Your X account is connected. You can now share your achievements and updates directly to X.</p>
                </div>
                <div className="flex-shrink-0">
                  <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
                    <Check className="w-6 h-6 text-white" />
                  </div>
                </div>
              </div>
              <div className="flex flex-col justify-center items-center lg:w-72 w-full">
                <Button
                  variant="outline"
                  className="w-full bg-transparent border-red-500 text-red-500 hover:bg-red-500 hover:text-white transition-all duration-200 font-semibold text-lg py-4"
                  onClick={handleXDisconnect}
                  disabled={isLoading}
                >
                  <XIcon className="w-6 h-6 mr-2" />
                  Disconnect X
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col lg:flex-row items-center lg:items-stretch lg:space-x-12 space-y-8 lg:space-y-0 w-full">
              <div className="flex flex-col justify-center items-center flex-1 min-w-0">
                <h3 className="text-gray-900 font-bold text-3xl mb-3">Connect your X account</h3>
                <p className="text-gray-500 text-lg leading-relaxed text-center max-w-lg">
                  Share your achievements, connect with your community, and showcase your progress on X. You can disconnect at any time.
                </p>
              </div>
              <div className="flex flex-col justify-center items-center lg:w-72 w-full">
                <Button
                  className="w-full bg-black text-white hover:bg-gray-900 font-bold py-4 transition-all duration-200 shadow-lg text-lg"
                  onClick={handleXConnect}
                  disabled={isLoading}
                >
                  Connect X Account
                </Button>
                <div className="bg-[#f5f8fa] border border-gray-200 rounded-lg p-4 mt-6 w-full">
                  <p className="text-gray-500 text-sm text-center">
                    We will never post without your permission. You can disconnect at any time.
                  </p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}