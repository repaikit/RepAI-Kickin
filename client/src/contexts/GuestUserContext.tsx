import { createContext, useContext, ReactNode } from 'react';
import { useGuestUser } from '@/hooks/useGuestUser';
import { GuestUser } from '@/types/guest';

interface GuestUserContextType {
  guestUser: GuestUser | null;
  isLoading: boolean;
  error: Error | null;
}

const GuestUserContext = createContext<GuestUserContextType | undefined>(undefined);

export function GuestUserProvider({ children }: { children: ReactNode }) {
  const guestUserData = useGuestUser();

  return (
    <GuestUserContext.Provider value={guestUserData}>
      {children}
    </GuestUserContext.Provider>
  );
}

export function useGuestUserContext() {
  const context = useContext(GuestUserContext);
  if (context === undefined) {
    throw new Error('useGuestUserContext must be used within a GuestUserProvider');
  }
  return context;
} 