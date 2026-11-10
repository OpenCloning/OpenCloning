import React, { createContext, useContext } from 'react';

export const OidcAuthContext = createContext(null);

export function useOidcAuth() {
  const auth = useContext(OidcAuthContext);
  if (!auth) {
    throw new Error('useOidcAuth must be used within an OIDC auth provider');
  }
  return auth;
}
