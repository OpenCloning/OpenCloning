import { loadHistory } from '../common_functions';

describe('Tests template functionality', () => {
  beforeEach(() => {
    cy.visit('/');
  });
  it('can add sequence in between for templates', () => {
    loadHistory('cypress/test_files/template_example.json');

    // The add in between is displayed where it should
    cy.get('li#source-3 div.before-node-sequence-in-between').should('exist');
    cy.get('li#source-4 div.before-node-sequence-in-between').should('exist');
    cy.get('div.before-node-sequence-in-between').should('have.length', 2);

    // On normal sequences it is not displayed
    cy.get('li#source-6 div.before-node-visibility').should('exist');
    cy.get('div.before-node-visibility').should('have.length', 1);

    // When adding one it works for single input source
    cy.get('li#source-3 div.before-node-sequence-in-between').click();
    cy.get('li#source-3 li#sequence-7 li#source-7 li#sequence-1').should('exist');

    // When adding one it works for multi input source
    cy.get('li#source-4 div.before-node-sequence-in-between').first().click();
    cy.get('li#source-4 li#sequence-8 li#source-8 li#sequence-2 li#source-2').should('exist');
    cy.get('li#source-4 li#sequence-8 li#source-8 li#sequence-3 li#source-3').should('exist');
  });
});
