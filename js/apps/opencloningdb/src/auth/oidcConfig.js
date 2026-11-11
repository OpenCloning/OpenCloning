import {
  ClerkLoginPage,
  ClerkOidcAuthProvider,
  ClerkSignUpPage,
} from './providers/clerkOidc';
import { TestLoginPage, TestOidcAuthProvider, TestSignUpPage } from './providers/testOidc';

const providers = {
  clerk: {
    AuthProvider: ClerkOidcAuthProvider,
    LoginPage: ClerkLoginPage,
    SignUpPage: ClerkSignUpPage,
  },
  test: {
    AuthProvider: TestOidcAuthProvider,
    LoginPage: TestLoginPage,
    SignUpPage: TestSignUpPage,
  },
};

export function getOidcProviderId() {
  const id = import.meta.env.VITE_OIDC_PROVIDER || 'clerk';
  if (!providers[id]) {
    throw new Error(`Unknown OIDC provider: ${id}`);
  }
  return id;
}

export function getOidcProvider() {
  return providers[getOidcProviderId()];
}
