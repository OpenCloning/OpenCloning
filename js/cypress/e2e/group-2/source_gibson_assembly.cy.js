import { addSource, manuallyTypeSequence, clickMultiSelectOption, loadHistory, deleteSourceById } from '../common_functions';

describe('Tests Gibson assembly functionality', () => {
  beforeEach(() => {
    cy.visit('/');
  });
  it('works in the normal case', () => {
    loadHistory('cypress/test_starting_point/source_gibson_assembly.json');
    cy.get('li#sequence-2', { timeOut: 20000 });
    addSource('GibsonAssemblySource');
    clickMultiSelectOption('Assembly inputs', '2', 'li#source-9');
    clickMultiSelectOption('Assembly inputs', '3', 'li#source-9');

    cy.get('li#source-9 li#sequence-1').should('exist');
    cy.get('li#source-9 li#sequence-2').should('exist');
    cy.get('li#source-9 li#sequence-3').should('exist');
    cy.get('li#source-9 button').contains('Submit').click();
    cy.get('.submit-backend-api .loading-progress').should('not.exist', { timeout: 20000 });

    cy.get('li#source-9').contains('Gibson assembly');

    cy.get('li#sequence-9').contains('Payload 1');
    cy.get('li#sequence-9').contains('Payload 2');
    cy.get('li#sequence-9').contains('Payload 3');
  });
  it('correctly applies circular constrain and shows the right errors', () => {
    loadHistory('cypress/test_starting_point/source_gibson_assembly.json');
    cy.get('li#sequence-2', { timeOut: 20000 });
    // Remove sequence that allows circularisation
    deleteSourceById(1);
    addSource('GibsonAssemblySource');
    clickMultiSelectOption('Assembly inputs', '3', 'li#source-9');
    // Constrain to circular
    cy.get('#tab-panel-0 span').contains('Circular assemblies').click();
    // Should show an error
    cy.get('li#source-9 button').contains('Submit').click();
    cy.get('.submit-backend-api .loading-progress').should('not.exist', { timeout: 20000 });
    cy.get('li#source-9 .MuiAlert-message').contains('No circular assembly');
    // Remove the circular constraint
    cy.get('#tab-panel-0 span').contains('Circular assemblies').click();
    cy.get('li#source-9 button').contains('Submit').click();
    cy.get('.submit-backend-api .loading-progress').should('not.exist', { timeout: 20000 });
    cy.get('li#source-9').contains('Gibson assembly');
    cy.get('li#sequence-9').contains('Payload 2');
    cy.get('li#sequence-9').contains('Payload 3');
  });
  it('works for single inputs', () => {
    manuallyTypeSequence('aagaattcaaaaGTCGACaacccccaagaattcaaaaGTCGACaa');
    addSource('GibsonAssemblySource');
    cy.get('li#source-2 button').contains('Submit').click();
    cy.get('.submit-backend-api .loading-progress').should('not.exist', { timeout: 20000 });
    cy.get('li#sequence-2 li#source-2').contains('Gibson assembly');
    cy.get('li#sequence-2').contains('25 bps');
  });
});

// TODO: minimal homology, resubmission, errors from server
