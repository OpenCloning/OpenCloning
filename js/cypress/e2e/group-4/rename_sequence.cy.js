import { clearInputValue, manuallyTypeSequence, setInputValue} from '../common_functions';

describe('Can rename a sequence', () => {
  beforeEach(() => {
    cy.visit('/');
  });
  it('Works as expected', () => {
    manuallyTypeSequence('atata');
    cy.get('li#sequence-1 .sequenceNameText').contains('name').should('exist');
    cy.get('li#sequence-1 svg[data-testid="EditIcon"]').click();
    // Cannot submit if name didn't change
    cy.get('div[role="presentation"] button').contains('Cancel').should('exist');
    cy.get('div[role="presentation"] button').contains('Rename').should('not.exist');
    // Cannot submit if empty
    clearInputValue('New name', 'div[role="presentation"]');
    cy.get('div[role="presentation"] button').contains('Cancel').should('exist');
    cy.get('div[role="presentation"] button').contains('Rename').should('not.exist');
    // Back to previous name
    // For some reason we have to click outside, I think the tooltip is messing this up
    cy.get('div[role="presentation"]').contains('Rename sequence').first().click();
    setInputValue('New name', 'name', 'div[role="presentation"]');
    cy.get('div[role="presentation"] button').contains('Cancel').should('exist');
    cy.get('div[role="presentation"] button').contains('Rename').should('not.exist');
    // Cannot submit if name contains spaces
    setInputValue('New name', ' with space', 'div[role="presentation"]');
    cy.get('div[role="presentation"] button').contains('Cancel').should('exist');
    cy.get('div[role="presentation"] button').contains('Rename').should('not.exist');
    // Can submit if name changed
    clearInputValue('New name', 'div[role="presentation"]');
    setInputValue('New name', 'name-2', 'div[role="presentation"]');
    cy.get('div[role="presentation"] button').contains('Cancel').should('exist');
    cy.get('div[role="presentation"] button').contains('Rename').should('exist');
    cy.get('div[role="presentation"] button').contains('Rename').click();
    // The field is set in the data model
    cy.get('button.MuiTab-root').contains('Data model').click();
    cy.get('code').contains('"output_name": "name-2"').should('exist');
    // If the server is down, you get an error
    cy.get('button.MuiTab-root').contains('Cloning').click();
    cy.get('li#sequence-1 svg[data-testid="EditIcon"]').click();
    cy.get('div[role="presentation"]').contains('Rename sequence').first().click();
    setInputValue('New name', 'name-3', 'div[role="presentation"]');
    cy.intercept('POST', 'http://127.0.0.1:8000/*', { forceNetworkError: true }).as('error');
    cy.get('div[role="presentation"] button').contains('Rename').click();
    cy.wait('@error');
    cy.get('div[role="presentation"]').contains('Cannot connect to backend server').should('exist');
  });
});
