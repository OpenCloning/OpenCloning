import { addSource, changeTab, deleteSourceById, manuallyTypeSequence } from '../common_functions';

describe('Tests Reverse Complement Source functionality', () => {
  beforeEach(() => {
    cy.visit('/');
  });

  it('returns the correct reverse complement sequence', () => {
    // Manually type the original sequence
    manuallyTypeSequence('TTCG');

    // Add a Reverse Complement Source
    addSource('ReverseComplementSource');

    // Perform the reverse complement operation
    cy.get('button').contains('Reverse complement').click();

    // Check that the resulting sequence is the reverse complement
    cy.get('li#sequence-2 svg[data-testid="VisibilityIcon"]').first().click();
    cy.get('.veTabSequenceMap').contains('Sequence Map').click();
    cy.get('.main-sequence-editor').within(() => {
      cy.get('svg.rowViewTextContainer text').contains('ttcg').should('not.exist');
      cy.get('svg.rowViewTextContainer text').contains('cgaa').should('exist');
    });

    // Check that an error is displayed when server is down
    changeTab('Cloning');
    deleteSourceById(2);
    addSource('ReverseComplementSource');
    cy.intercept('POST', 'http://127.0.0.1:8000/reverse_complement', {
      forceNetworkError: true,
    }).as('reverseComplementError');

    cy.get('button').contains('Reverse complement').click();
    cy.wait('@reverseComplementError').then(() => {
      cy.get('.MuiAlert-message').should('exist');
    });
  });
});
