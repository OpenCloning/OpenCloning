import { useEffect } from 'react';
import { setHttpClientTokenGetter, setUnauthorizedHandler } from '@opencloning/opencloningdb';
import { useOidcAuth } from '../auth/OidcAuthContext';
import useChangeWorkspace from './useChangeWorkspace';
import { fetchUserAndFirstWorkspace } from '../utils/auth_utils';

export default function useAuthBootstrap() {
  const { isLoaded, isSignedIn, getToken } = useOidcAuth();
  const { applySession, logout } = useChangeWorkspace();

  useEffect(() => {
    setUnauthorizedHandler(() => {
      logout();
    });
  }, [logout]);

  useEffect(() => {
    setHttpClientTokenGetter(getToken);
    return () => setHttpClientTokenGetter(null);
  }, [getToken]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return undefined;

    let cancelled = false;

    (async () => {
      try {
        const { user, workspace } = await fetchUserAndFirstWorkspace();
        if (!cancelled) {
          applySession(user, workspace);
        }
      } catch {
        // A 401 signs the user out from the response interceptor.
      }
    })();

    // This runs if the user is signed out or the component is unmounted
    // to stop the effect from running
    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, applySession]);
}
