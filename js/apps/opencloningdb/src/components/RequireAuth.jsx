import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { Alert, Box, Button, CircularProgress, Stack } from '@mui/material';
import { useOidcAuth } from '../auth/OidcAuthContext';
import useChangeWorkspace from '../hooks/useChangeWorkspace';

function FullPageMessage({ children }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', p: 2 }}>
      {children}
    </Box>
  );
}

export default function RequireAuth({ children }) {
  const { isLoaded, isSignedIn } = useOidcAuth();
  const user = useSelector((state) => state.auth.user);
  const workspaceId = useSelector((state) => state.auth.workspace?.id);
  const sessionError = useSelector((state) => state.auth.sessionError);
  const location = useLocation();
  const { logout } = useChangeWorkspace();

  if (isLoaded && !isSignedIn) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (sessionError) {
    return (
      <FullPageMessage>
        <Alert
          severity="error"
          action={(
            // The app bar (with its user menu) is not shown here, so this is the only way to log out
            <Stack direction="row" spacing={1}>
              {sessionError.retryable && (
                <Button color="inherit" size="small" onClick={() => window.location.reload()}>Retry</Button>
              )}
              <Button color="inherit" size="small" onClick={logout}>Log out</Button>
            </Stack>
          )}
        >
          {sessionError.message}
        </Alert>
      </FullPageMessage>
    );
  }

  // Waiting for the auth provider, or for the user and workspace to be fetched
  if (!isLoaded || !user || !workspaceId) {
    return (
      <FullPageMessage>
        <CircularProgress data-testid="require-auth-loading" />
      </FullPageMessage>
    );
  }

  return children;
}
