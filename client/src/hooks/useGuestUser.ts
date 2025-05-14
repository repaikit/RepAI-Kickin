import { useEffect, useState, useRef } from 'react';
import { API_ENDPOINTS, defaultFetchOptions } from '@/config/api';
import { GuestUser } from '@/types/guest';

export const useGuestUser = () => {
  const [guestUser, setGuestUser] = useState<GuestUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const isInitializedRef = useRef(false);

  const fetchCurrentUser = async (sessionId: string): Promise<GuestUser | null> => {
    try {
      console.log('Fetching guest user with session ID:', sessionId);
      const response = await fetch(
        `${API_ENDPOINTS.users.getGuest(sessionId)}`,
        defaultFetchOptions
      );
      
      if (response.ok) {
        const data = await response.json();
        console.log('Fetched guest user data:', data);
        return data;
      }

      if (response.status === 404) {
        console.log('Guest user not found, removing session');
        localStorage.removeItem('guestSessionId');
      } else {
        console.log('Error fetching guest user, but keeping session');
      }
      return null;
    } catch (err) {
      console.error('Error fetching guest user:', err);
      return null;
    }
  };

  const createGuestUser = async (): Promise<GuestUser | null> => {
    try {
      console.log('Creating new guest user...');
      const response = await fetch(
        API_ENDPOINTS.users.createGuest,
        {
          ...defaultFetchOptions,
          method: 'POST',
        }
      );

      if (!response.ok) {
        throw new Error('Failed to create guest user');
      }

      const data = await response.json();
      console.log('New guest user created:', data);
      
      localStorage.setItem('guestSessionId', data.session_id);
      
      return data;
    } catch (err) {
      console.error('Error creating guest user:', err);
      throw err;
    }
  };

  useEffect(() => {
    const initializeGuestUser = async () => {
      if (isInitializedRef.current) {
        console.log('Guest user already initialized, skipping...');
        return;
      }

      try {
        isInitializedRef.current = true;
        console.log('Initializing guest user...');
        
        const existingSessionId = localStorage.getItem('guestSessionId');
        console.log('Existing session ID:', existingSessionId);
        
        if (existingSessionId) {
          const userData = await fetchCurrentUser(existingSessionId);
          if (userData) {
            console.log('Using existing guest user:', userData);
            setGuestUser(userData);
            setIsLoading(false);
            return;
          }
          console.log('Existing guest user not found, removing session ID');
          localStorage.removeItem('guestSessionId');
        }

        console.log('Creating new guest user...');
        const newUserData = await createGuestUser();
        if (newUserData) {
          console.log('Setting new guest user:', newUserData);
          setGuestUser(newUserData);
        }
      } catch (err) {
        console.error('Error in guest user initialization:', err);
        setError(err instanceof Error ? err : new Error('Unknown error occurred'));
      } finally {
        setIsLoading(false);
      }
    };

    initializeGuestUser();
  }, []);

  return {
    guestUser,
    isLoading,
    error,
  };
}; 