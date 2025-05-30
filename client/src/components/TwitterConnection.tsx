import React, { useEffect, useState } from 'react';
import { Button } from "@/components/ui/button";
import { API_ENDPOINTS, defaultFetchOptions } from '@/config/api';
import { toast } from "sonner";
import { RefreshCw } from 'lucide-react';

interface XConnectionProps {
  userId: string;
}

const XConnection: React.FC<XConnectionProps> = ({ userId }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [username, setUsername] = useState<string | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const checkXConnection = async () => {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) {
        setIsLoading(false);
        return;
      }

      const response = await fetch(API_ENDPOINTS.x.status, {
        ...defaultFetchOptions,
        credentials: 'include',
        headers: {
          ...defaultFetchOptions.headers,
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to check X connection');
      }

      const data = await response.json();
      setIsConnected(data.is_connected);
      setUsername(data.username);
      setIsFollowing(data.is_following);
    } catch (error) {
      console.error('Error checking X connection:', error);
      toast.error('Error checking X connection');
    } finally {
      setIsLoading(false);
    }
  };

  const connectX = async () => {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) {
        toast.error('Please login first');
        return;
      }

      const response = await fetch(API_ENDPOINTS.x.connect, {
        ...defaultFetchOptions,
        credentials: 'include',
        headers: {
          ...defaultFetchOptions.headers,
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to connect X');
      }

      const data = await response.json();
      // Mở cửa sổ popup để đăng nhập X
      const width = 600;
      const height = 600;
      const left = window.screen.width / 2 - width / 2;
      const top = window.screen.height / 2 - height / 2;
      
      window.open(
        data.auth_url,
        'X Login',
        `width=${width},height=${height},left=${left},top=${top}`
      );

      // Lưu state để kiểm tra callback
      localStorage.setItem('x_auth_state', data.state);
    } catch (error) {
      console.error('Error connecting X:', error);
      toast.error('Error connecting X');
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await checkXConnection();
      toast.success('X connection refreshed');
    } catch (error) {
      console.error('Error refreshing X connection:', error);
      toast.error('Error refreshing X connection');
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    checkXConnection();
  }, []);

  // Kiểm tra callback từ X
  useEffect(() => {
    const handleCallback = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const session = urlParams.get('session');
      
      if (session) {
        try {
          // Lưu session vào localStorage hoặc state management
          localStorage.setItem('x_session', session);
          
          // Refresh trạng thái kết nối
          await checkXConnection();
          
          // Xóa params khỏi URL
          window.history.replaceState({}, document.title, window.location.pathname);
          
          toast.success('Successfully connected to X');
        } catch (error) {
          console.error('Error handling X callback:', error);
          toast.error('Error connecting to X');
        }
      }
    };

    handleCallback();
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pink-500"></div>
      </div>
    );
  }

  return (
    <div className="bg-black/20 backdrop-blur-sm border border-pink-500/20 rounded-lg p-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white mb-1">X Connection</h3>
          {isConnected ? (
            <p className="text-sm text-gray-300">
              Connected as @{username}
              {isFollowing ? ' (Following @kickin_ai)' : ' (Not following @kickin_ai)'}
            </p>
          ) : (
            <p className="text-sm text-gray-300">Not connected to X</p>
          )}
        </div>
        <div className="flex items-center space-x-2">
          {isConnected && (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="text-pink-500 hover:text-pink-400"
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </Button>
          )}
          <Button
            onClick={connectX}
            disabled={isConnected}
            className="bg-pink-500 hover:bg-pink-600 text-white"
          >
            {isConnected ? 'Connected' : 'Connect X'}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default XConnection; 