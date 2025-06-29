import { createContext, useContext, useEffect, useState } from "react";
import { API_ENDPOINTS, defaultFetchOptions } from "@/config/api";
import { useRouter } from "next/router";

interface User {
  _id: string;
  user_type: string;
  email?: string;
  wallet: string;
  name: string;
  avatar?: string;
  auth_provider: "email" | "google" | "guest";
  session_id?: string;
  kicker_skills?: string[];
  goalkeeper_skills?: string[];
  remaining_matches?: number;
  total_kicked?: number;
  kicked_win?: number;
  total_keep?: number;
  keep_win?: number;
  total_point?: number;
  extra_point?: number;
  is_pro?: boolean;
  created_at?: string;
  updated_at?: string;
  last_login?: string;
  level?: number;
  legend_level?: number;
  vip_level?: string;
  is_vip?: boolean;
  last_activity?: string;
  position?: string;
  total_point_for_level?: number;
  can_level_up?: boolean;
  role?: string;
  is_active?: boolean;
  is_verified?: boolean;
  trend?: string;
  last_box_open?: string;
  mystery_box_history?: string[];
  last_claim_matches?: string;
  daily_tasks?: string[];
  vip_amount?: number;
  vip_year?: number;
  vip_payment_method?: string;
  isAuthenticated?: boolean;
  available_skill_points?: number;
  evm_address?: string;
  sol_address?: string;
  sui_address?: string;
  evm_private_key?: string;
  sol_private_key?: string;
  sui_private_key?: string;
  evm_mnemonic?: string;
  sol_mnemonic?: string;
  sui_mnemonic?: string;
  x_connected?: boolean;
  x_id?: string;
  x_username?: string;
  x_access_token?: string;
  x_refresh_token?: string;
  x_token_expires_at?: number;
  x_main_account_id?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
  isLoading: boolean;
  checkAuth: () => Promise<void>;
  logout: () => void;
  refreshTokens: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  isAuthenticated: false,
  isLoading: true,
  checkAuth: async () => {},
  logout: () => {},
  refreshTokens: async () => false,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const publicRoutes = ["/login", "/register", "/verify-email"];
  const isAuthenticated = !!user;
  const isLoading = loading;

  const refreshTokens = async (): Promise<boolean> => {
    try {
      const refresh_token = localStorage.getItem("refresh_token");
      if (!refresh_token) {
        return false;
      }

      const response = await fetch(API_ENDPOINTS.users.refresh, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${refresh_token}`,
        },
      });

      if (!response.ok) {
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
        return false;
      }

      const data = await response.json();
      localStorage.setItem("access_token", data.access_token);
      localStorage.setItem("refresh_token", data.refresh_token);
      return true;
    } catch (error) {
      console.error("Token refresh failed:", error);
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
      return false;
    }
  };

  const checkAuth = async () => {
    try {
      const token = localStorage.getItem("access_token");
      const currentPath = router.pathname;

      if (!token) {
        setUser(null);
        setLoading(false);
        if (!publicRoutes.includes(currentPath)) {
          router.replace("/login");
        }
        return;
      }

      const response = await fetch(API_ENDPOINTS.users.me, {
        method: "GET",
        headers: {
          ...defaultFetchOptions.headers,
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          // Thử refresh token
          const refreshSuccess = await refreshTokens();
          if (refreshSuccess) {
            // Thử lại request với token mới
            const newToken = localStorage.getItem("access_token");
            const retryResponse = await fetch(API_ENDPOINTS.users.me, {
              method: "GET",
              headers: {
                ...defaultFetchOptions.headers,
                "Content-Type": "application/json",
                Authorization: `Bearer ${newToken}`,
              },
            });

            if (retryResponse.ok) {
              const userData = await retryResponse.json();
              setUser(userData);
              setLoading(false);
              return;
            }
          }
          
          // Nếu refresh thất bại, logout
          localStorage.removeItem("access_token");
          localStorage.removeItem("refresh_token");
          setUser(null);
          if (!publicRoutes.includes(currentPath)) {
            router.replace("/login");
          }
        }
        throw new Error("Failed to fetch user data");
      }

      const userData = await response.json();
      setUser(userData);

      // Kiểm tra role và điều hướng
      if (userData.role === "admin") {
        // Admin có thể truy cập tất cả các trang
        if (publicRoutes.includes(currentPath)) {
          router.replace("/");
        }
        return;
      } else {
        // Nếu không phải admin và đang cố truy cập trang admin
        if (currentPath.startsWith("/admin")) {
          router.replace("/");
          return;
        }
        // Nếu đang ở public route nhưng đã login thì đưa về trang chủ
        if (publicRoutes.includes(currentPath)) {
          router.replace("/");
        }
      }
    } catch (error) {
      console.error("Auth check error:", error);
      setUser(null);
      if (!publicRoutes.includes(router.pathname)) {
        router.replace("/login");
      }
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    setUser(null);
    router.push("/login");
  };

  useEffect(() => {
    checkAuth();
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, loading, isAuthenticated, isLoading, checkAuth, logout, refreshTokens }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
