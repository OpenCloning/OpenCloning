import endpoints from '../../../packages/opencloningdb/src/endpoints';


describe('Locate sequence in database', () => {
  beforeEach(() => {
    cy.e2eLogin('/design', 'view-only-user@example.com', 'password');
  });
  it('works', () => {
    cy.dragAndDropFile('cypress/test_files/connected_gibson.json');
    cy.get('li').contains('connected_gibson.dna', { timeout: 20000 }).should('exist');
    cy.checkSequenceNotInDatabase('1');
    cy.checkSequenceNotInDatabase('2');
    cy.intercept('POST', Cypress.getDbURL(endpoints.sequenceSearch, '*')).as('locateSequenceInDatabase');
    cy.get('[aria-label="Synchronize sequences with database"]').click({ force: true });
    cy.wait('@locateSequenceInDatabase', { timeout: 20000 })
    cy.checkSequenceInDatabase('1');
    cy.checkSequenceInDatabase('2');
    cy.checkSequenceNotInDatabase('5');
    cy.checkSequenceNotInDatabase('6');
    cy.checkSequenceNotInDatabase('7');
    cy.openCloningAlertExists('Sequence 1 located in database');
    cy.openCloningAlertExists('Sequence 2 located in database');
    cy.closeAlerts();

    // Calling again prints the message that nothing is found, since those already have the database id set
    cy.get('[aria-label="Synchronize sequences with database"]').click({ force: true });
    cy.openCloningAlertExists('No sequences located in database');
    cy.closeAlerts();

    // Now we delete the children
    cy.deleteSourceByContent('PCR with primers');
    cy.deleteSourceByContent('Restriction with');

    // Clicking again should not make a request
    cy.intercept('POST', Cypress.getDbURL(endpoints.sequenceSearch, '*')).as('locateSequenceInDatabase2');
    cy.get('[aria-label="Synchronize sequences with database"]').click({ force: true });
    cy.openCloningAlertExists('All sequences are already in the database');
    cy.closeAlerts();
    cy.get('@locateSequenceInDatabase2.all').should('have.length', 0);

  });
});
