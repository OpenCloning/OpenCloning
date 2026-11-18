import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { setHttpClientTokenGetter, setUnauthorizedHandler } from '@opencloning/opencloningdb';
import { useOidcAuth } from '../auth/OidcAuthContext';
import useChangeWorkspace from './useChangeWorkspace';
import { fetchUserAndFirstWorkspace, NoWorkspacesError } from '../utils/auth_utils';
import { setSessionError } from '../store/authSlice';

export default function useAuthBootstrap() {
  const { isLoaded, isSignedIn, getToken } = useOidcAuth();
  const { applySession, logout } = useChangeWorkspace();
  const dispatch = useDispatch();

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
    dispatch(setSessionError(null));

    (async () => {
      try {
        const { user, workspace } = await fetchUserAndFirstWorkspace();
        if (!cancelled) {
          applySession(user, workspace);
        }
      } catch (e) {
        // A 401 signs the user out from the response interceptor.
        // Anything else would leave the app waiting forever (blank page), so show the error.
        if (!cancelled && e?.response?.status !== 401) {
          console.error(e);
          dispatch(setSessionError({
            message: e?.response?.data?.detail || e?.message || 'Could not load your account',
            retryable: !(e instanceof NoWorkspacesError),
          }));
        }
      }
    })();

    // This runs if the user is signed out or the component is unmounted
    // to stop the effect from running
    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, applySession, dispatch]);
}
