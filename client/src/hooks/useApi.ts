import { useState, useCallback, useRef } from 'react';
import { API_ENDPOINTS, defaultFetchOptions } from '@/config/api';

interface CacheItem {
  data: any;
  timestamp: number;
}

interface PendingRequest {
  promise: Promise<any>;
  timestamp: number;
}

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
const apiCache: { [key: string]: CacheItem } = {};
const pendingRequests: { [key: string]: PendingRequest } = {};

export function useApi() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const refreshToken = async (): Promise<boolean> => {
    try {
      const refresh_token = localStorage.getItem('refresh_token');
      if (!refresh_token) {
        return false;
      }

      const response = await fetch(API_ENDPOINTS.users.refreshToken, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${refresh_token}`,
        },
      });

      if (!response.ok) {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        return false;
      }

      const data = await response.json();
      localStorage.setItem('access_token', data.access_token);
      localStorage.setItem('refresh_token', data.refresh_token);
      return true;
    } catch (error) {
      console.error('Token refresh failed:', error);
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      return false;
    }
  };

  const fetchWithCache = useCallback(async (
    endpoint: string,
    options: RequestInit = {},
    forceRefresh = false
  ) => {
    const now = Date.now();
    const cacheKey = `${endpoint}-${JSON.stringify(options)}`;
    
    // Clear old cache entries (older than 5 minutes)
    Object.keys(apiCache).forEach(key => {
      if (now - apiCache[key].timestamp > 5 * 60 * 1000) {
        delete apiCache[key];
      }
    });

    // Check if we have a valid cached response
    if (!forceRefresh && apiCache[cacheKey] && now - apiCache[cacheKey].timestamp < 5 * 60 * 1000) {
      return apiCache[cacheKey].data;
    }

    // Check if there's already a pending request for this endpoint
    if (pendingRequests[cacheKey]) {
      return pendingRequests[cacheKey].promise;
    }

    setLoading(true);
    setError(null);

    // Cancel previous request if it exists
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    try {
      const token = localStorage.getItem('access_token');
      const headers = {
        ...defaultFetchOptions.headers,
        ...options.headers,
        'Authorization': token ? `Bearer ${token}` : '',
      };

      const makeRequest = async (): Promise<any> => {
        const response = await fetch(endpoint, {
          ...defaultFetchOptions,
          ...options,
          headers,
          signal: abortControllerRef.current!.signal,
        });

        if (!response.ok) {
          if (response.status === 401) {
            // Thử refresh token
            const refreshSuccess = await refreshToken();
            if (refreshSuccess) {
              // Thử lại request với token mới
              const newToken = localStorage.getItem('access_token');
              const retryResponse = await fetch(endpoint, {
                ...defaultFetchOptions,
                ...options,
                headers: {
                  ...defaultFetchOptions.headers,
                  ...options.headers,
                  'Authorization': newToken ? `Bearer ${newToken}` : '',
                },
                signal: abortControllerRef.current!.signal,
              });

              if (!retryResponse.ok) {
                throw new Error('Request failed after token refresh');
              }
              return await retryResponse.json();
            } else {
              // Nếu refresh thất bại, redirect to login
              window.location.href = '/login';
              throw new Error('Unauthorized');
            }
          }
          throw new Error('Request failed');
        }
        return await response.json();
      };

      const requestPromise = makeRequest();

      // Store pending request
      pendingRequests[cacheKey] = {
        promise: requestPromise,
        timestamp: now,
      };

      const data = await requestPromise;

      // Update cache if we have data
      if (data !== null && data !== undefined) {
        apiCache[cacheKey] = {
          data,
          timestamp: now,
        };
      }

      return data;
    } catch (err: any) {
      if (err.name === 'AbortError') {
        return null;
      }
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
      delete pendingRequests[cacheKey];
    }
  }, []);

  const clearCache = useCallback((endpoint?: string) => {
    if (endpoint) {
      Object.keys(apiCache).forEach(key => {
        if (key.startsWith(endpoint)) {
          delete apiCache[key];
        }
      });
    } else {
      Object.keys(apiCache).forEach(key => delete apiCache[key]);
    }
  }, []);

  return {
    fetchWithCache,
    clearCache,
    loading,
    error,
  };
} 