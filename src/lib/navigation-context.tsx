'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';

interface NavigationContextType {
  navigateTo: (page: string) => void;
  activePage: string;
}

const NavigationContext = createContext<NavigationContextType>({
  navigateTo: () => {},
  activePage: 'dashboard',
});

export function NavigationProvider({ children }: { children: React.ReactNode }) {
  const [activePage, setActivePage] = useState('dashboard');

  const navigateTo = useCallback((page: string) => {
    setActivePage(page);
  }, []);

  return (
    <NavigationContext.Provider value={{ navigateTo, activePage }}>
      {children}
    </NavigationContext.Provider>
  );
}

export function useNavigation(): NavigationContextType {
  return useContext(NavigationContext);
}
