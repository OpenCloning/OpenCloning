import React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import store from '../store';
import { clearUser, setSessionError, setWorkspace } from '../store/authSlice';
import { TestOidcAuthProvider } from '../auth/providers/testOidc';
import RequireAuth from './RequireAuth';

function mountRequireAuth() {
  cy.mount(
    <TestOidcAuthProvider>
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<RequireAuth><div data-cy="protected">protected</div></RequireAuth>} />
          <Route path="/login" element={<div data-cy="login-page">login</div>} />
        </Routes>
      </MemoryRouter>
    </TestOidcAuthProvider>,
    { reduxStore: store },
  );
}

describe('<RequireAuth />', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('token', 'some-token');
    store.dispatch(clearUser());
    store.dispatch(setWorkspace(null));
    store.dispatch(setSessionError(null));
  });

  it('shows a spinner while the session is loading', () => {
    mountRequireAuth();
    cy.get('[data-testid="require-auth-loading"]').should('be.visible');
    cy.get('[data-cy="protected"]').should('not.exist');
  });

  it('shows Retry and Log out for a retryable error', () => {
    store.dispatch(setSessionError({ message: 'Database unavailable', retryable: true }));
    mountRequireAuth();
    cy.contains('Database unavailable').should('be.visible');
    cy.contains('button', 'Retry').should('be.visible');
    cy.contains('button', 'Log out').should('be.visible');
  });

  it('shows only Log out when retrying cannot help, and logging out goes to login', () => {
    store.dispatch(setSessionError({ message: 'No workspaces', retryable: false }));
    mountRequireAuth();
    cy.contains('No workspaces').should('be.visible');
    cy.contains('button', 'Retry').should('not.exist');
    cy.contains('button', 'Log out').click();
    cy.get('[data-cy="login-page"]').should('be.visible');
    cy.then(() => {
      expect(store.getState().auth.sessionError).to.equal(null);
      expect(localStorage.getItem('token')).to.equal(null);
    });
  });
});
