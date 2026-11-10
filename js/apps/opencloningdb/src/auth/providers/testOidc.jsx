import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { Link as RouterLink, useLocation, useNavigate } from 'react-router-dom';
import { Alert, Box, Button, FormControl, InputLabel, Link, MenuItem, Select, TextField, Typography } from '@mui/material';
import { OidcAuthContext } from '../OidcAuthContext';
import { buildTestToken, TEST_USERS } from '../testUsers';

const TestSignInContext = createContext(null);

export function TestOidcAuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('token'));

  const signIn = useCallback((nextToken) => {
    localStorage.setItem('token', nextToken);
    setToken(nextToken);
  }, []);

  const signOut = useCallback(async () => {
    localStorage.removeItem('token');
    setToken(null);
  }, []);

  const value = useMemo(
    () => ({
      isLoaded: true,
      isSignedIn: Boolean(token),
      getToken: () => localStorage.getItem('token'),
      signOut,
    }),
    [token, signOut],
  );

  return (
    <OidcAuthContext.Provider value={value}>
      <TestSignInContext.Provider value={signIn}>
        {children}
      </TestSignInContext.Provider>
    </OidcAuthContext.Provider>
  );
}

function redirectAfterAuth(navigate, location) {
  const from = location.state?.from;
  const destination = from
    ? `${from.pathname}${from.search || ''}`
    : '/sequences';
  navigate(destination, { replace: true });
}

function TestAuthPageShell({ children }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', flexDirection: 'column', gap: 4 }}>
      <Typography sx={{ color: 'primary.main' }} variant="h1" textAlign="center">
        OpenCloningDB
      </Typography>
      {children}
    </Box>
  );
}

export function TestLoginPage() {
  const signIn = useContext(TestSignInContext);
  const navigate = useNavigate();
  const location = useLocation();
  const [selectedId, setSelectedId] = useState('');

  const handleSubmit = (event) => {
    event.preventDefault();
    const user = TEST_USERS.find((candidate) => candidate.id === selectedId);
    if (!user || !signIn) return;

    signIn(user.token);
    redirectAfterAuth(navigate, location);
  };

  return (
    <TestAuthPageShell>
      <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 320 }}>
        <FormControl fullWidth>
          <InputLabel id="test-oidc-user-label">User</InputLabel>
          <Select
            labelId="test-oidc-user-label"
            label="User"
            value={selectedId}
            onChange={(event) => setSelectedId(event.target.value)}
            data-testid="test-oidc-user-select"
          >
            {TEST_USERS.map((user) => (
              <MenuItem key={user.id} value={user.id}>
                {user.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <Button
          type="submit"
          variant="contained"
          data-testid="test-oidc-sign-in"
          disabled={!selectedId}
        >
          Sign in
        </Button>
        <Link component={RouterLink} to="/signup" align="center">
          Sign up
        </Link>
      </Box>
    </TestAuthPageShell>
  );
}

export function TestSignUpPage() {
  const signIn = useContext(TestSignInContext);
  const navigate = useNavigate();
  const location = useLocation();
  const [subject, setSubject] = useState('');
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');

  const fields = {
    subject: subject.trim(),
    email: email.trim(),
    displayName: displayName.trim(),
  };
  const canSubmit = Boolean(fields.subject && fields.email && fields.displayName);

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!canSubmit || !signIn) return;

    signIn(buildTestToken(fields));
    redirectAfterAuth(navigate, location);
  };

  return (
    <TestAuthPageShell>
      <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 320 }}>
        <TextField
          label="Subject"
          value={subject}
          inputProps={{ pattern: '^[^\\|]+$' }}
          onChange={(event) => setSubject(event.target.value)}
        />
        <TextField
          label="Email"
          value={email}
          type="email"
          onChange={(event) => setEmail(event.target.value)}
        />
        <TextField
          label="Display name"
          value={displayName}
          inputProps={{ pattern: '^[^\\|]+$' }}
          onChange={(event) => setDisplayName(event.target.value)}
        />
        <Button type="submit" variant="contained" disabled={!canSubmit}>
          Create user
        </Button>
        <Link component={RouterLink} to="/login" align="center">
          Sign in
        </Link>
      </Box>
    </TestAuthPageShell>
  );
}
