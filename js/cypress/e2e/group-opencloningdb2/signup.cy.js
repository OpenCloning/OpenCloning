import endpoints from '../../../packages/opencloningdb/src/endpoints';
import { buildTestToken } from '../../../apps/opencloningdb/src/auth/testUsers';

describe('opencloningdb sign up', () => {
  afterEach(() => {
    cy.resetDB();
  });

  it('shows validation error when a field contains a pipe', () => {
    cy.visit('/signup');
    cy.setInputValue('Subject', 'e2e-user');
    cy.setInputValue('Email', 'e2e-mismatch@example.com');
    cy.setInputValue('Display name', 'E2E | User');
    cy.get('button[type="submit"]').click();
    // No validation error is shown (html5 validation), but the form does not go through
    cy.location('pathname').should('eq', '/signup');
  });

  it('navigates between login and sign up', () => {
    cy.visit('/login');
    cy.contains('a', 'Sign up').click();
    cy.location('pathname').should('eq', '/signup');
    cy.contains('a', 'Sign in').click();
    cy.location('pathname').should('eq', '/login');
  });

  it('registers a new user and lands on sequences', () => {
    const subject = 'e2e-signup';
    const email = 'e2e-signup@example.com';
    const displayName = 'E2E Signup';
    const token = buildTestToken({ subject, email, displayName });

    cy.visit('/signup');
    cy.setInputValue('Subject', subject);
    cy.setInputValue('Email', email);
    cy.setInputValue('Display name', displayName);
    cy.intercept('GET', Cypress.getDbURL(endpoints.authMe)).as('authMe');
    cy.intercept('GET', Cypress.getDbURL(endpoints.sequences, '*')).as('getSequences');
    cy.get('button[type="submit"]').click();
    cy.window().its('localStorage').invoke('getItem', 'token').should('equal', token);
    cy.wait('@authMe').its('response.body.email').should('eq', email);
    cy.get('@authMe').its('response.body.display_name').should('eq', displayName);
    cy.wait('@getSequences');
    cy.location('pathname').should('eq', '/sequences');
    cy.contains('Sequences').should('be.visible');
  });
});
