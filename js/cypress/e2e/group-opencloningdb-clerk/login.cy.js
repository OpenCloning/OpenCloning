import { setupClerkTestingToken } from '@clerk/testing/cypress';
import endpoints from '../../../packages/opencloningdb/src/endpoints';

function signInBootstrap() {
  setupClerkTestingToken();
  cy.visit('/login');
  cy.clerkSignIn({
    strategy: 'email_code',
    identifier: 'bootstrap+clerk_test@example.com',
  });
  cy.visit('/sequences');
  cy.contains('Sequences').should('be.visible');
}

describe('clerk sign in', () => {
  it('signs in and lands on sequences', () => {
    signInBootstrap();
  });

  it('signs up a new user and lands on sequences', () => {
    const email = `signup-${Date.now()}+clerk_test@example.com`;
    setupClerkTestingToken();
    cy.visit('/signup');
    cy.clerkLoaded();
    cy.intercept('GET', Cypress.getDbURL(endpoints.authMe)).as('authMe');
    cy.window().then(async (win) => {
      const { signUp } = win.Clerk.client;
      await signUp.create({
        emailAddress: email,
        password: 'ClerkTestPassword1!',
        firstName: 'Bootstrap',
        lastName: 'User',
      });
      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
      const attempt = await signUp.attemptEmailAddressVerification({ code: '424242' });
      if (attempt.status !== 'complete') {
        const missing = (attempt.missingFields || []).join(', ') || 'none';
        throw new Error(`Sign-up status is ${attempt.status} (missing: ${missing})`);
      }
      await win.Clerk.setActive({ session: attempt.createdSessionId });
    });
    cy.visit('/sequences');
    cy.wait('@authMe').its('response.body.email').should('eq', email);
    cy.contains('Sequences').should('be.visible');
  });

  it('signs out and sends protected routes back to login', () => {
    signInBootstrap();
    cy.get('[data-testid="opencloningdb-appbar-account"]').click();
    cy.contains('[role="menuitem"]', 'Sign out').click();
    cy.location('pathname').should('eq', '/login');
    cy.visit('/sequences');
    cy.location('pathname').should('eq', '/login');
  });

  it('keeps the session after reload', () => {
    signInBootstrap();
    cy.reload();
    cy.contains('Sequences').should('be.visible');
    cy.get('[data-testid="opencloningdb-appbar-account"]').should('contain', 'Bootstrap User');
  });
});
