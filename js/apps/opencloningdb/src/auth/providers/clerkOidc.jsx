import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ClerkProvider, SignIn, SignUp, useAuth, useClerk } from '@clerk/react';
import { Box, Typography } from '@mui/material';
import { OidcAuthContext } from '../OidcAuthContext';

function ClerkOidcBridge({ children }) {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const { signOut } = useClerk();
  const value = useMemo(
    () => ({
      isLoaded,
      isSignedIn,
      getToken: () => getToken({ template: 'default' }),
      signOut,
    }),
    [isLoaded, isSignedIn, getToken, signOut],
  );

  return <OidcAuthContext.Provider value={value}>{children}</OidcAuthContext.Provider>;
}

export function ClerkOidcAuthProvider({ children }) {
  const navigate = useNavigate();

  return (
    <ClerkProvider
      publishableKey={import.meta.env.VITE_CLERK_PUBLISHABLE_KEY}
      routerPush={(to) => navigate(to)}
      routerReplace={(to) => navigate(to, { replace: true })}
      signInUrl="/login"
      signUpUrl="/signup"
      signInFallbackRedirectUrl="/sequences"
      signUpFallbackRedirectUrl="/sequences"
    >
      <ClerkOidcBridge>{children}</ClerkOidcBridge>
    </ClerkProvider>
  );
}

function AuthPageShell({ children }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', flexDirection: 'column', gap: 4 }}>
      <Typography sx={{ color: 'primary.main' }} variant="h1" textAlign="center">
        OpenCloningDB
      </Typography>
      {children}
    </Box>
  );
}

export function ClerkLoginPage() {
  return (
    <AuthPageShell>
      <SignIn
        routing="path"
        path="/login"
        signUpUrl="/signup"
        fallbackRedirectUrl="/sequences"
        forceRedirectUrl="/sequences"
      />
    </AuthPageShell>
  );
}

export function ClerkSignUpPage() {
  return (
    <AuthPageShell>
      <SignUp
        routing="path"
        path="/signup"
        signInUrl="/login"
        fallbackRedirectUrl="/sequences"
        forceRedirectUrl="/sequences"
      />
    </AuthPageShell>
  );
}
