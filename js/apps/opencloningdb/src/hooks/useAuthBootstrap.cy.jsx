import React from 'react';
import { useSelector } from 'react-redux';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import {
  clearWorkspaceHeader,
  openCloningDBHttpClient,
  setWorkspaceHeader,
  endpoints,
} from '@opencloning/opencloningdb';
import store from '../store';
import { clearUser, setUser, setWorkspace } from '../store/authSlice';
import { TestOidcAuthProvider } from '../auth/providers/testOidc';
import useAuthBootstrap from './useAuthBootstrap';
import { LAST_WORKSPACE_ID_KEY } from '../utils/auth_utils';
import { baseUrl } from '@opencloning/opencloningdb';

const DB_URL = baseUrl;

const TEST_USER = {
  id: 1,
  display_name: 'Dummy user',
};

const TEST_WORKSPACE = {
  id: 7,
  name: 'Main Lab',
  role: 'owner',
};

const OTHER_WORKSPACE = {
  id: 12,
  name: 'Side Project',
  role: 'member',
};

function AuthBootstrapProbe() {
  useAuthBootstrap();

  const location = useLocation();
  const userName = useSelector((state) => state.auth.user?.display_name ?? '');
  const workspaceName = useSelector((state) => state.auth.workspace?.name ?? '');

  return (
    <div>
      <div data-cy="path">{location.pathname}</div>
      <div data-cy="user-name">{userName}</div>
      <div data-cy="workspace-name">{workspaceName}</div>
    </div>
  );
}

function LoginRouteProbe() {
  const location = useLocation();

  return (
    <div>
      <div data-cy="path">{location.pathname}</div>
      <div data-cy="login-page">login</div>
    </div>
  );
}

function mountHook() {
  cy.mount(
    <TestOidcAuthProvider>
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<AuthBootstrapProbe />} />
          <Route path="/login" element={<LoginRouteProbe />} />
        </Routes>
      </MemoryRouter>
    </TestOidcAuthProvider>,
    { reduxStore: store },
  );
}

describe('useAuthBootstrap', () => {
  beforeEach(() => {
    localStorage.clear();
    clearWorkspaceHeader();
    store.dispatch(clearUser());
    store.dispatch(setWorkspace(null));
  });

  it('bootstraps the session when a token is present', () => {
    localStorage.setItem('token', 'bootstrap-token');

    cy.intercept('GET', `${DB_URL}${endpoints.authMe}`, (req) => {
      expect(req.headers.authorization).to.equal('Bearer bootstrap-token');
      req.reply({ statusCode: 200, body: TEST_USER });
    }).as('authMe');

    cy.intercept('GET', `${DB_URL}${endpoints.workspaces}`, (req) => {
      expect(req.headers.authorization).to.equal('Bearer bootstrap-token');
      req.reply({ statusCode: 200, body: [TEST_WORKSPACE] });
    }).as('workspaces');

    mountHook();

    cy.wait('@authMe');
    cy.wait('@workspaces');
    cy.get('[data-cy="user-name"]').should('have.text', TEST_USER.display_name);
    cy.get('[data-cy="workspace-name"]').should('have.text', TEST_WORKSPACE.name);
    cy.get('[data-cy="path"]').should('have.text', '/');
    return cy.then(() => {
      expect(store.getState().auth.user).to.deep.equal(TEST_USER);
      expect(store.getState().auth.workspace).to.deep.equal(TEST_WORKSPACE);
      expect(openCloningDBHttpClient.defaults.headers.common['X-Workspace-Id']).to.equal(TEST_WORKSPACE.id);
    });
  });

  it('restores the remembered workspace when multiple workspaces are available', () => {
    localStorage.setItem('token', 'bootstrap-token');
    localStorage.setItem(LAST_WORKSPACE_ID_KEY, String(OTHER_WORKSPACE.id));

    cy.intercept('GET', `${DB_URL}${endpoints.authMe}`, (req) => {
      expect(req.headers.authorization).to.equal('Bearer bootstrap-token');
      req.reply({ statusCode: 200, body: TEST_USER });
    }).as('authMe');

    cy.intercept('GET', `${DB_URL}${endpoints.workspaces}`, (req) => {
      expect(req.headers.authorization).to.equal('Bearer bootstrap-token');
      req.reply({ statusCode: 200, body: [TEST_WORKSPACE, OTHER_WORKSPACE] });
    }).as('workspaces');

    mountHook();

    cy.wait('@authMe');
    cy.wait('@workspaces');
    cy.get('[data-cy="workspace-name"]').should('have.text', OTHER_WORKSPACE.name);
    return cy.then(() => {
      expect(store.getState().auth.workspace).to.deep.equal(OTHER_WORKSPACE);
      expect(openCloningDBHttpClient.defaults.headers.common['X-Workspace-Id']).to.equal(OTHER_WORKSPACE.id);
    });
  });

  it('falls back to the first workspace when the remembered id is stale', () => {
    localStorage.setItem('token', 'bootstrap-token');
    localStorage.setItem(LAST_WORKSPACE_ID_KEY, '999');

    cy.intercept('GET', `${DB_URL}${endpoints.authMe}`, (req) => {
      req.reply({ statusCode: 200, body: TEST_USER });
    }).as('authMe');

    cy.intercept('GET', `${DB_URL}${endpoints.workspaces}`, (req) => {
      req.reply({ statusCode: 200, body: [TEST_WORKSPACE, OTHER_WORKSPACE] });
    }).as('workspaces');

    mountHook();

    cy.wait('@authMe');
    cy.wait('@workspaces');
    cy.get('[data-cy="workspace-name"]').should('have.text', TEST_WORKSPACE.name);
    return cy.then(() => {
      expect(store.getState().auth.workspace).to.deep.equal(TEST_WORKSPACE);
      expect(openCloningDBHttpClient.defaults.headers.common['X-Workspace-Id']).to.equal(TEST_WORKSPACE.id);
    });
  });

  it('clears the token and redirects to login when bootstrap is unauthorized', () => {
    localStorage.setItem('token', 'expired-token');
    store.dispatch(setUser(TEST_USER));
    store.dispatch(setWorkspace(TEST_WORKSPACE));
    setWorkspaceHeader(TEST_WORKSPACE.id);

    cy.intercept('GET', `${DB_URL}${endpoints.authMe}`, (req) => {
      expect(req.headers.authorization).to.equal('Bearer expired-token');
      req.reply({ statusCode: 401, body: { detail: 'Unauthorized' } });
    }).as('authMe');

    mountHook();

    cy.wait('@authMe');
    cy.get('[data-cy="login-page"]').should('be.visible');
    cy.get('[data-cy="path"]').should('have.text', '/login');
    return cy.then(() => {
      expect(localStorage.getItem('token')).to.equal(null);
      expect(store.getState().auth.user).to.equal(null);
      expect(store.getState().auth.workspace).to.equal(null);
      expect(openCloningDBHttpClient.defaults.headers.common['X-Workspace-Id']).to.equal(undefined);
    });
  });
});
