import { addLane, addSource, clickMultiSelectOption, deleteSourceByContent, loadExample, manuallyTypeSequence } from '../common_functions';

describe('Cre/Lox recombination', () => {
  beforeEach(() => {
    cy.visit('/');
  });
  it('can reproduce the example', () => {
    loadExample('Cre/Lox');
    // Remove all sources after initial inputs
    deleteSourceByContent('Cre/Lox recombination');
    deleteSourceByContent('Cre/Lox recombination');
    deleteSourceByContent('Cre/Lox recombination');
    // First Cre/Lox recombination
    addSource('CreLoxRecombinationSource');
    cy.get('div.assembly button').contains('Submit').click();
    cy.get('.multiple-output-selector svg[data-testid="ArrowForwardIcon"]').should('exist', { timeout: 20000 });
    cy.get('button').contains('Choose product').click();

    // Second Cre/Lox recombination
    addSource('CreLoxRecombinationSource', false, 1);
    cy.get('div.assembly button').contains('Submit').click();
    cy.get('.multiple-output-selector svg[data-testid="ArrowForwardIcon"]').should('exist', { timeout: 20000 });
    cy.get('.multiple-output-selector svg[data-testid="ArrowForwardIcon"]').click();
    cy.get('button').contains('Choose product').click();

    // Third Cre/Lox recombination
    addSource('CreLoxRecombinationSource');
    clickMultiSelectOption('Assembly inputs', 'Select all', 'li');
    cy.get('div.assembly button').contains('Submit').click();

    // All sequences should be present
    cy.get('div.veEditor').should('have.length', 6);
    cy.get('div.veEditor').filter(':contains("151 bps")').should('have.length', 3);
    cy.get('div.veEditor').filter(':contains("113 bps")').should('have.length', 1);
    cy.get('div.veEditor').filter(':contains("38 bps")').should('have.length', 1);
  });
  it('gives the right error when sequences are not compatible', () => {
    manuallyTypeSequence('aagaattcaaaagaattcaa');
    addLane();
    manuallyTypeSequence('tagatatca');
    addSource('CreLoxRecombinationSource');
    clickMultiSelectOption('Assembly inputs', 'Select all', 'li');
    cy.get('div.assembly button').contains('Submit').click();
    cy.get('li .MuiAlert-message').contains('No compatible Cre/Lox recombination was found');
  });
});
