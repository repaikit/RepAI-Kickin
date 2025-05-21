import React, { createContext, useContext, useState } from 'react';

type PageType = 'dashboard' | 'profile' | 'matches' | 'players' | 'statistics';

interface PageContextType {
  activePage: PageType;
  setActivePage: (page: PageType) => void;
}

const PageContext = createContext<PageContextType | undefined>(undefined);

export function PageProvider({ children }: { children: React.ReactNode }) {
  const [activePage, setActivePage] = useState<PageType>('dashboard');

  return (
    <PageContext.Provider value={{ activePage, setActivePage }}>
      {children}
    </PageContext.Provider>
  );
}

export function usePage() {
  const context = useContext(PageContext);
  if (context === undefined) {
    throw new Error('usePage must be used within a PageProvider');
  }
  return context;
} 