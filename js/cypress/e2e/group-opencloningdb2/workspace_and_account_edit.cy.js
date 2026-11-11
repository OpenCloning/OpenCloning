import endpoints from '../../../packages/opencloningdb/src/endpoints';


describe('workspace and account (edit)', () => {
  afterEach(() => {
    cy.resetDB();
  });

  function openAccountMenu() {
    cy.get('[data-testid="opencloningdb-appbar-account"]').click();
  }


  it('creates a workspace from the workspace page', () => {
    cy.e2eLogin('/workspace', 'bootstrap+clerk_test@example.com', 'password');
    cy.contains('h5', 'Manage workspaces').should('be.visible');
    cy.contains('h6', 'Create workspace').closest('.MuiPaper-root').within(() => {
      cy.setInputValue('Workspace name', 'e2e-created-workspace', 'div');
      cy.get('button').contains('Create').click();
    });
    cy.dbAlertExists('Workspace "e2e-created-workspace" created and activated');
    cy.closeDbAlerts();
    cy.get('.MuiToolbar-root .MuiTypography-caption').contains('e2e-created-workspace').should('exist');
  });

  it('renames the current workspace', () => {
    const newName = 'e2e-renamed';
    cy.e2eLogin('/workspace', 'bootstrap+clerk_test@example.com', 'password');
    cy.contains('h5', 'Manage workspaces').should('be.visible');
    cy.contains('h6', 'Rename current workspace').closest('.MuiPaper-root').within(() => {
      cy.setInputValue('Workspace name', newName, 'div');
      cy.get('button').contains('Rename').click();
    });
    cy.dbAlertExists('Workspace renamed successfully');
    cy.closeDbAlerts();
    cy.get('.MuiToolbar-root .MuiTypography-caption').contains(newName).should('exist');
  });

  it('switches workspace and sends x-workspace-id on the next list request', () => {
    cy.intercept('GET', Cypress.getDbURL(endpoints.workspaces, '*')).as('getWorkspaces');
    cy.e2eLogin('/workspace', 'bootstrap+clerk_test@example.com', 'password');
    cy.wait('@getWorkspaces').then(({ response: { body } }) => {
      cy.contains('h5', 'Manage workspaces').should('be.visible');
      expect(body).to.have.length.greaterThan(0);
      const originalWorkspaceId = body[0].id;
      const originalName = body[0].name;

      cy.intercept('POST', Cypress.getDbURL(endpoints.postWorkspace)).as('createWorkspace');
      cy.contains('h6', 'Create workspace').closest('.MuiPaper-root').within(() => {
        cy.setInputValue('Workspace name', 'e2e-second-workspace', 'div');
        cy.get('button').contains('Create').click();
      });
      cy.wait('@createWorkspace').then(({ response: { body } }) => {
        const newWorkspaceId = body.id;
        expect(body.name).to.eq('e2e-second-workspace');
        cy.dbAlertExists('Workspace "e2e-second-workspace" created and activated');
        cy.closeDbAlerts();
        cy.get('.MuiToolbar-root .MuiTypography-caption').contains('e2e-second-workspace').should('exist');
        cy.intercept('GET', Cypress.getDbURL(endpoints.sequences, '*')).as('getSequences');
        cy.changeTab('Sequences');
        cy.wait('@getSequences').then(({ request }) => {
          expect(request.headers).to.have.property('x-workspace-id', String(newWorkspaceId));
        });

        cy.get('tbody tr').should('have.length', 0);
      });

      openAccountMenu();
      cy.contains('Switch workspaces').click();
      cy.contains('.MuiDialog-root', 'Switch workspace').find('.MuiSelect-select').click();
      cy.get('ul[role="listbox"] li').contains(originalName).click();
      cy.contains('.MuiDialog-root', 'Switch workspace').contains('button', 'Switch').click();

      cy.intercept('GET', Cypress.getDbURL(endpoints.sequences, '*')).as('getSequencesAfterSwitch');
      // We use visit to trigger new request, otherwise the query cache is used and no request is sent.
      cy.visit('/sequences');
      cy.wait('@getSequencesAfterSwitch').then(({ request }) => {
        expect(request.headers).to.have.property('x-workspace-id', String(originalWorkspaceId));
      });
    });
  });

  it('shows workspace members section for owners only', () => {
    cy.e2eLogin('/workspace', 'bootstrap+clerk_test@example.com', 'password');
    cy.contains('h6', 'Workspace members').should('be.visible');

    openAccountMenu();
    cy.contains('Sign out').click();
    cy.e2eLogin('/workspace', 'view-only-user@example.com', 'password');
    cy.contains('h6', 'Workspace members').should('not.exist');
  });

  it('lists, adds, and removes workspace members', () => {
    cy.intercept('GET', Cypress.getDbURL('/workspaces/', '*/users')).as('getWorkspaceUsers');
    cy.e2eLogin('/workspace', 'bootstrap+clerk_test@example.com', 'password');
    cy.wait('@getWorkspaceUsers').then(({ response: { body: members } }) => {
      cy.get('h6').contains('Workspace members').should('exist');
      cy.get('[data-testid="workspace-members-list"]').within(() => {
        cy.contains('Bootstrap User').should('exist');
        cy.contains('View Only User').should('exist');
      });
      const viewOnlyMember = members.find((member) => member.display_name === 'View Only User');
      expect(viewOnlyMember).to.exist;

      cy.intercept('POST', Cypress.getDbURL('/workspaces/', '*/users')).as('addWorkspaceUser');
      cy.contains('h6', 'Workspace members').closest('.MuiPaper-root').within(() => {
        cy.setInputValue('Email', 'other-workspace-user@example.com', 'div');
        cy.get('button').contains('Add').click();
      });
      cy.wait('@addWorkspaceUser').its('response.statusCode').should('eq', 201);
      cy.dbAlertExists('Member added');
      cy.closeDbAlerts();
      cy.get('[data-testid="workspace-members-list"]').contains('Other Workspace User').should('exist');

      cy.intercept('DELETE', Cypress.getDbURL('/workspaces/', `*/users/${viewOnlyMember.id}`)).as('removeWorkspaceUser');
      cy.get(`[data-testid="remove-member-${viewOnlyMember.id}"]`).click();
      cy.contains('.MuiDialog-root', 'Remove member').contains('button', 'Remove').click();
      cy.wait('@removeWorkspaceUser').its('response.statusCode').should('eq', 200);
      cy.dbAlertExists('View Only User removed from workspace');
      cy.closeDbAlerts();
      cy.contains('View Only User').should('not.exist');
    });
  });

  it('changing workspace clears the design tab', () => {
    cy.e2eLogin('/design', 'bootstrap+clerk_test@example.com', 'password');
    cy.get('.open-cloning', { timeout: 20000 }).should('exist');
    cy.manuallyTypeSequence('AACCCCTTTGGG', true);
    cy.get('li#sequence-1').should('exist');
    openAccountMenu();
    cy.contains('Manage workspaces').click();
    cy.contains('h6', 'Create workspace').closest('.MuiPaper-root').within(() => {
      cy.setInputValue('Workspace name', 'e2e-second-workspace', 'div');
      cy.get('button').contains('Create').click();
    });
    cy.dbAlertExists('Workspace "e2e-second-workspace" created and activated');
    cy.closeDbAlerts();
    cy.get('.MuiToolbar-root .MuiTypography-caption').contains('e2e-second-workspace').should('exist');
    cy.changeTab('Design');
    cy.get('.open-cloning').should('exist');
    cy.get('li#sequence-1').should('not.exist');
  });
});
