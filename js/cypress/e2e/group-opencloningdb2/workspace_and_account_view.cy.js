import endpoints from '../../../packages/opencloningdb/src/endpoints';

describe('workspace and account', () => {

  function openAccountMenu() {
    cy.get('[data-testid="opencloningdb-appbar-account"]').click();
  }

  it('opens Manage workspaces from the app bar', () => {
    cy.e2eLogin('/sequences', 'view-only-user@example.com', 'password');
    openAccountMenu();
    cy.contains('Manage workspaces').click();
    cy.location('pathname').should('eq', '/workspace');
    cy.contains('h5', 'Manage workspaces').should('be.visible');
  });

  it('signs out and clears the token', () => {
    cy.e2eLogin('/sequences', 'view-only-user@example.com', 'password');
    cy.resolveTestUserByEmail('view-only-user@example.com').then((user) => {
      cy.window().its('localStorage').invoke('getItem', 'token').should('equal', user.token);
    });
    openAccountMenu();
    cy.contains('Sign out').click();
    cy.location('pathname').should('eq', '/login');
    cy.window().its('localStorage').invoke('getItem', 'token').should('be.null');
  });

  it('logging out clears the design tab', () => {
    cy.e2eLogin('/design', 'view-only-user@example.com', 'password');
    cy.get('.open-cloning', { timeout: 20000 }).should('exist');
    cy.manuallyTypeSequence('AACCCCTTTGGG', true);
    cy.get('li#sequence-1').should('exist');
    openAccountMenu();
    cy.contains('Sign out').click();
    cy.intercept('GET', Cypress.getDbURL(endpoints.authMe)).as('authMe');
    cy.intercept('GET', Cypress.getDbURL(endpoints.workspaces)).as('workspaces');
    cy.get('[data-testid="test-oidc-user-select"]').click();
    cy.resolveTestUserByEmail('view-only-user@example.com').then((user) => {
      cy.get(`li[data-value="${user.id}"]`).click();
    });
    cy.get('[data-testid="test-oidc-sign-in"]').click();
    cy.wait('@authMe');
    cy.wait('@workspaces');
    cy.changeTab('Design');
    cy.get('.open-cloning').should('exist');
    cy.get('li#sequence-1').should('not.exist');
  });

  it('can bulk-download the workspace', () => {
    const fixedDate = new Date('2025-06-09T12:00:00.000Z');
    cy.clock(fixedDate.getTime(), ['Date']);

    cy.e2eLogin('/workspace', 'view-only-user@example.com', 'password');
    cy.get('.MuiToolbar-root .MuiTypography-caption').invoke('text').then((workspaceName) => {
      const safeName = workspaceName.replaceAll('/', '_').replaceAll(' ', '_');
      const fileName = `opencloning_db_${safeName}_dump_${fixedDate.toISOString().replaceAll(':', '_').slice(0, 19)}.json`;

      cy.intercept('GET', Cypress.getDbURL(endpoints.export)).as('exportWorkspace');
      cy.get('button').contains('Export workspace').click();
      cy.wait('@exportWorkspace')
      cy.dbAlertExists('Workspace exported successfully');
      cy.closeDbAlerts();
      cy.readFile(`cypress/downloads/${fileName}`).then((content) => {
        expect(content).to.have.property('lines');
        expect(content).to.have.property('primers');
        expect(content).to.have.property('sequences');
        expect(content).to.have.property('tags');
        expect(content).to.have.property('users');
        expect(content).to.have.property('cloning_strategy');
      });
    });
  });
});
