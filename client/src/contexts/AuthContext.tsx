import { createContext, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { API_ENDPOINTS, defaultFetchOptions } from '@/config/api';
import { usePrivy } from '@privy-io/react-auth';

interface User {
  _id: string;
  name: string;
  email: string;
  avatar: string;
  user_type: string;
  role: string;
  is_active: boolean;
  is_verified: boolean;
  trend: string;
  level: number;
  is_pro: boolean;
  position: string;
  total_point: number;
  bonus_point: number;
  total_kicked: number;
  kicked_win: number;
  total_keep: number;
  keep_win: number;
  legend_level: number;
  vip_level: string;
  remaining_matches: number;
  kicker_skills: string[];
  goalkeeper_skills: string[];
  wallet?: string;
  is_vip?: boolean;
  created_at?: string;
  last_activity?: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  checkAuth: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const { logout: privyLogout } = usePrivy();

  const checkAuth = async () => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem('access_token');
      if (!token) {
        setUser(null);
        setIsLoading(false);
        router.push('/login');
        return;
      }

      const response = await fetch(API_ENDPOINTS.users.getCurrentUser, {
        method: 'GET',
        headers: {
          ...defaultFetchOptions.headers,
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
      } else {
        setUser(null);
        localStorage.removeItem('access_token');
        router.push('/login');
      }
    } catch (error) {
      console.error('Auth check error:', error);
      setUser(null);
      localStorage.removeItem('access_token');
      router.push('/login');
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      setIsLoading(true);
      // Gọi Privy logout trước
        await privyLogout();
      // Sau đó xóa token và state local
      localStorage.removeItem('access_token');
      setUser(null);
      router.push('/login');
    } catch (error) {
      console.error('Logout error:', error);
      // Trong trường hợp có lỗi, vẫn xóa token và state local
      localStorage.removeItem('access_token');
      setUser(null);
      router.push('/login');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        checkAuth,
        logout
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
} 