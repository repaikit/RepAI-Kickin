import { useEffect, useState, useRef, useCallback } from 'react';
import { API_ENDPOINTS } from '@/config/api';
import { GuestUser } from '@/types/guest';

const SESSION_KEY = 'sessionId';
const API_TIMEOUT = 5000;
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

const getSessionId = () => {
  try {
    const sessionId = window.localStorage.getItem(SESSION_KEY);
    console.log('[DEBUG] getSessionId:', sessionId);
    return sessionId;
  } catch {
    return null;
  }
};

const setSessionId = (sessionId: string) => {
  try {
    console.log('[DEBUG] setSessionId:', sessionId);
    window.localStorage.setItem(SESSION_KEY, sessionId);
  } catch (error) {
    console.error('[DEBUG] Error setting sessionId:', error);
  }
};

const clearSessionId = () => {
  try {
    console.log('[DEBUG] clearSessionId');
    window.localStorage.removeItem(SESSION_KEY);
  } catch {}
};

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const useGuestUser = () => {
  const [guestUser, setGuestUser] = useState<GuestUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isMounted = useRef(false);
  const isCreatingUser = useRef(false);
  const initializationPromise = useRef<Promise<void> | null>(null);

  const fetchCurrentUser = useCallback(async (sessionId: string, retryCount = 0) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT);

    try {
      console.log('[DEBUG] Fetching current user with sessionId:', sessionId);
      const response = await fetch(`${API_ENDPOINTS.users.getCurrentUser}?session_id=${sessionId}`, {
        method: 'GET',
        credentials: 'include',
        headers: { 'Accept': 'application/json' },
        signal: controller.signal
      });

      if (!response.ok) {
        if (retryCount < MAX_RETRIES) {
          console.log(`[DEBUG] Retrying fetch current user (${retryCount + 1}/${MAX_RETRIES})...`);
          await sleep(RETRY_DELAY);
          return fetchCurrentUser(sessionId, retryCount + 1);
        }
        console.log('[DEBUG] Failed to fetch current user:', response.status);
        return null;
      }

      const data = await response.json();
      console.log('[DEBUG] Fetched current user:', data);
      return data;
    } catch (error) {
      if (retryCount < MAX_RETRIES) {
        console.log(`[DEBUG] Retrying fetch current user after error (${retryCount + 1}/${MAX_RETRIES})...`);
        await sleep(RETRY_DELAY);
        return fetchCurrentUser(sessionId, retryCount + 1);
      }
      console.log('[DEBUG] Error fetching current user:', error);
      return null;
    } finally {
      clearTimeout(timeoutId);
    }
  }, []);

  const createGuestUser = useCallback(async (retryCount = 0) => {
    if (isCreatingUser.current) {
      console.log('[DEBUG] Already creating a guest user, skipping...');
      return null;
    }

    isCreatingUser.current = true;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT);

    try {
      console.log('[DEBUG] Creating new guest user...');
      const response = await fetch(API_ENDPOINTS.users.createGuest, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
        },
        signal: controller.signal
      });

      if (!response.ok) {
        if (retryCount < MAX_RETRIES) {
          console.log(`[DEBUG] Retrying create guest user (${retryCount + 1}/${MAX_RETRIES})...`);
          await sleep(RETRY_DELAY);
          return createGuestUser(retryCount + 1);
        }
        throw new Error(`Failed to create guest user: ${response.status}`);
      }

      const data = await response.json();
      console.log('[DEBUG] Guest user created:', data);

      if (!data.session_id) {
        throw new Error('No session_id in response');
      }

      // Save session ID and set initial user data
      setSessionId(data.session_id);
      setGuestUser(data);
      console.log('[DEBUG] Set initial user data:', data);

      // Immediately fetch current user data
      const currentUser = await fetchCurrentUser(data.session_id);
      if (currentUser) {
        console.log('[DEBUG] Fetched current user after creation:', currentUser);
        setGuestUser(currentUser);
        return currentUser;
      }

      return data;
    } catch (error) {
      if (retryCount < MAX_RETRIES) {
        console.log(`[DEBUG] Retrying create guest user after error (${retryCount + 1}/${MAX_RETRIES})...`);
        await sleep(RETRY_DELAY);
        return createGuestUser(retryCount + 1);
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
      isCreatingUser.current = false;
    }
  }, [fetchCurrentUser]);

  const initializeGuestUser = useCallback(async () => {
    if (!isMounted.current) return;

    try {
      setError(null);
      const sessionId = getSessionId();
      console.log('[DEBUG] Initializing with sessionId:', sessionId);

      let user: GuestUser | null = null;

      if (sessionId) {
        // Try to fetch existing user
        user = await fetchCurrentUser(sessionId);
        if (user) {
          console.log('[DEBUG] Successfully fetched existing user');
          setGuestUser(user);
          setIsLoading(false);
          return;
        }
      }

      // If no session or fetch failed, create new user
      console.log('[DEBUG] Creating new guest user...');
      user = await createGuestUser();
      if (user) {
        console.log('[DEBUG] New user created and fetched:', user);
        setGuestUser(user);
      }
    } catch (err) {
      console.error('[DEBUG] Error in initializeGuestUser:', err);
      setError(err instanceof Error ? err.message : 'Failed to initialize guest user');
    } finally {
      setIsLoading(false);
    }
  }, [fetchCurrentUser, createGuestUser]);

  useEffect(() => {
    console.log('[DEBUG] useGuestUser hook mounted');
    isMounted.current = true;

    // Prevent multiple initializations
    if (!initializationPromise.current) {
      initializationPromise.current = initializeGuestUser().finally(() => {
        initializationPromise.current = null;
      });
    }

    return () => {
      console.log('[DEBUG] useGuestUser hook unmounted');
      isMounted.current = false;
    };
  }, [initializeGuestUser]);

  return {
    guestUser,
    isLoading,
    error,
    refresh: initializeGuestUser
  };
};
