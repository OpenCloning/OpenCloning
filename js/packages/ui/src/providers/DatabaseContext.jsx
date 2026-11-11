import React, { createContext, useContext } from 'react';

export const DatabaseContext = createContext(null);

export function DatabaseProvider({ value, children }) {
  return (
    <DatabaseContext.Provider value={value}>
      {children}
    </DatabaseContext.Provider>
  );
}

export function useDatabase() {
  return useContext(DatabaseContext);
}
