import endpoints from '../../../packages/opencloningdb/src/endpoints';

function signInAs(email) {
  return cy.resolveTestUserByEmail(email).then((user) => {
    cy.get('[data-testid="test-oidc-user-select"]').click();
    cy.get(`li[data-value="${user.id}"]`).click();
    cy.get('[data-testid="test-oidc-sign-in"]').click();
    return cy.wrap(user);
  });
}

describe('opencloningdb login', () => {
  it('requires a user selection', () => {
    cy.visit('/login');
    cy.get('[data-testid="test-oidc-sign-in"]').should('be.disabled');
    cy.location('pathname').should('eq', '/login');
  });

  it('logs in the bootstrap user, sets the workspace and token, and lands on /sequences', () => {
    cy.intercept('GET', Cypress.getDbURL(endpoints.authMe)).as('authMe');
    cy.intercept('GET', Cypress.getDbURL(endpoints.sequences, '*')).as('getSequences');
    cy.visit('/login');
    signInAs('bootstrap+clerk_test@example.com').then((user) => {
      cy.wait('@authMe');
      cy.window().its('localStorage').invoke('getItem', 'token').should('equal', user.token);
      cy.wait('@getSequences').then(({ request }) => {
        expect(request.headers).to.have.property('authorization', `Bearer ${user.token}`);
        expect(request.headers).to.have.property('x-workspace-id', '1');
      });
      cy.location('pathname').should('eq', '/sequences');
      cy.contains('Sequences').should('be.visible');
    });
  });

  it('redirects anonymous visits to /login', () => {
    cy.visit('/sequences');
    cy.location('pathname').should('eq', '/login');
  });

  it('after login, returns to the originally requested path and query', () => {
    cy.visit('/lines?uid=crispr_hdr-line');
    cy.location('pathname').should('eq', '/login');
    signInAs('view-only-user@example.com');
    cy.location('pathname').should('eq', '/lines');
    cy.location('search').should('eq', '?uid=crispr_hdr-line');
  });
});
