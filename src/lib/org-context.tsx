'use client';

import React, { createContext, useContext } from 'react';

interface OrgContextType {
  orgId: string;
  orgName: string;
}

const OrgContext = createContext<OrgContextType>({
  orgId: 'default',
  orgName: 'KHORVEN Finanzas',
});

export function OrgProvider({ children }: { children: React.ReactNode }) {
  return (
    <OrgContext.Provider value={{ orgId: 'default', orgName: 'KHORVEN Finanzas' }}>
      {children}
    </OrgContext.Provider>
  );
}

export function useOrg(): OrgContextType {
  return useContext(OrgContext);
}
