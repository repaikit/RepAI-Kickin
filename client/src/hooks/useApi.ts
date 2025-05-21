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

  const fetchWithCache = useCallback(async (
    endpoint: string,
    options: RequestInit = {},
    forceRefresh = false
  ) => {
    const cacheKey = `${endpoint}-${JSON.stringify(options)}`;
    const now = Date.now();

    // Check cache first
    if (!forceRefresh && apiCache[cacheKey] && (now - apiCache[cacheKey].timestamp) < CACHE_DURATION) {
      return apiCache[cacheKey].data;
    }

    // Check if there's a pending request for the same endpoint
    if (pendingRequests[cacheKey] && (now - pendingRequests[cacheKey].timestamp) < 5000) {
      return pendingRequests[cacheKey].promise;
    }

    // Create new request
    setLoading(true);
    setError(null);

    // Cancel previous request if exists
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

      const requestPromise = fetch(endpoint, {
        ...defaultFetchOptions,
        ...options,
        headers,
        signal: abortControllerRef.current.signal,
      }).then(async (response) => {
        if (!response.ok) {
          if (response.status === 401) {
            // Handle token refresh here if needed
            throw new Error('Unauthorized');
          }
          throw new Error('Request failed');
        }
        const data = await response.json();
        // Return data even if it's null or undefined
        return data;
      });

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