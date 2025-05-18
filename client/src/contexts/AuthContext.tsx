import { createContext, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { API_ENDPOINTS, defaultFetchOptions } from '@/config/api';
import { usePrivy } from '@privy-io/react-auth';

interface User {
  _id: string;
  user_type: string;
  email?: string;
  name: string;
  avatar?: string;
  session_id?: string;
  kicker_skills?: string[];
  goalkeeper_skills?: string[];
  remaining_matches?: number;
  total_kicked?: number;
  kicked_win?: number;
  total_keep?: number;
  keep_win?: number;
  total_point?: number;
  total_extra_skill?: number;
  extra_skill_win?: number;
  is_pro?: boolean;
  created_at?: string;
  updated_at?: string;
  last_login?: string;
  level?: number;
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
      console.log("DEBUG /api/me token:", token)
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
      } else if (response.status === 401 || response.status === 403) {
        setUser(null);
        localStorage.removeItem('access_token');
        router.push('/login');
      } else {
        setUser(null);
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