import {
  addSource, manuallyTypeSequence, clickMultiSelectOption, clickSequenceOutputArrow, addLane, closeAlerts,
  deleteSourceByContent,
} from '../common_functions';

describe('Tests restriction-ligation functionality', () => {
  beforeEach(() => {
    cy.visit('/');
  });
  it('works in the normal case', () => {
    manuallyTypeSequence('aaaaGAATTCaa');
    cy.get('svg[data-testid="AddCircleIcon"]', { timeout: 20000 }).last().click();
    manuallyTypeSequence('ccGAATTCcc');
    addSource('RestrictionAndLigationSource');
    clickMultiSelectOption('Assembly inputs', '2', 'li#source-3');
    clickMultiSelectOption('Enzymes used', 'EcoRI', 'li#source-3');
    cy.get('li#source-3 button').contains('Submit').click();
    cy.get('.submit-backend-api .loading-progress').should('not.exist', { timeout: 20000 });

    // Shows multiple options
    cy.get('li#source-3 .multiple-output-selector').should('exist');

    // Click to get result
    cy.get('li#source-3 button').contains('Choose product').click();

    // Check that the result is correct
    cy.get('li#source-3').contains('Restriction with EcoRI, then ligation');
    cy.get('li#sequence-3 li#source-3');
    cy.get('li#sequence-3').contains('12 bps');
  });
  it('works with single input', () => {
    manuallyTypeSequence('aaaaGAATTCttGAATTCccccc');
    addSource('RestrictionAndLigationSource');
    clickMultiSelectOption('Enzymes used', 'EcoRI', 'li#source-2');
    cy.get('li#source-2 button').contains('Submit').click();
    cy.get('.submit-backend-api .loading-progress').should('not.exist', { timeout: 20000 });

    // Shows multiple options, one round the other linear
    cy.get('li#source-2 .multiple-output-selector .veCircularView').contains('8 bps');
    clickSequenceOutputArrow('li#source-2');
    cy.get('li#source-2 .multiple-output-selector .veLinearView').contains('15 bps');

    // Click to get result
    cy.get('li#source-2 button').contains('Choose product').click();

    // // Check that the result is correct
    cy.get('li#source-2').contains('Restriction with EcoRI, then ligation');
    cy.get('li#sequence-2 li#source-2');
    cy.get('li#sequence-2').contains('15 bps');
  });
  it('circular constrain works', () => {
    manuallyTypeSequence('aaaaGAATTCttGAATTCccccc');
    addSource('RestrictionAndLigationSource');
    clickMultiSelectOption('Enzymes used', 'EcoRI', 'li#source-2');

    cy.get('#tab-panel-0 span').contains('Circular assemblies').click();
    cy.get('li#source-2 button').contains('Submit').click();
    cy.get('.submit-backend-api .loading-progress').should('not.exist', { timeout: 20000 });

    // // Check that the result is correct
    cy.get('li#source-2').contains('Restriction with EcoRI, then ligation');
    cy.get('li#sequence-2 li#source-2');
    cy.get('li#sequence-2 .veCircularView').contains('8 bps');
  });
  it('displays an error when ligations cannot be made', () => {
    manuallyTypeSequence('aaaaGAATTCttt');
    cy.get('svg[data-testid="AddCircleIcon"]', { timeout: 20000 }).last().click();
    manuallyTypeSequence('aaaaGTCGACttt');
    addSource('RestrictionAndLigationSource');

    clickMultiSelectOption('Enzymes used', 'EcoRI', 'li#source-3');
    clickMultiSelectOption('Enzymes used', 'SalI', 'li#source-3');
    clickMultiSelectOption('Assembly inputs', '2', 'li#source-3');

    cy.get('li#source-3 button').contains('Submit').click();
    cy.get('.submit-backend-api .loading-progress').should('not.exist', { timeout: 20000 });
    cy.get('li#source-3 .MuiAlert-message').contains('No compatible restriction-ligation was found');
  });
  it('displays errors when server fails', () => {
    manuallyTypeSequence('aagaattcaaaagaattcaa');
    addSource('RestrictionAndLigationSource');
    clickMultiSelectOption('Enzymes used', 'EcoRI', 'li#source-2');
    cy.intercept('POST', 'http://127.0.0.1:8000/restriction_and_ligation*', { forceNetworkError: true }).as('ligation');
    cy.get('li#source-2 button').contains('Submit').click();
    cy.get('.submit-backend-api .loading-progress').should('not.exist', { timeout: 20000 });
    cy.get('li#source-2 .MuiAlert-message').contains('Cannot connect');
    // Internal server error
    cy.intercept('POST', 'http://127.0.0.1:8000/restriction_and_ligation*', { statusCode: 500 }).as('ligation2');
    cy.get('li#source-2 button').contains('Submit').click();
    cy.get('.submit-backend-api .loading-progress').should('not.exist', { timeout: 20000 });
    cy.get('li#source-2 .MuiAlert-message').contains('Internal server error');
  });
  it('Gives error it too many possible products', () => {
    manuallyTypeSequence('aaGCGGCCGCaaGCGGCCGC', true);
    addLane();
    manuallyTypeSequence('aaGCGGCCGCaaGCGGCCGC', true);
    addLane();
    manuallyTypeSequence('aaGCGGCCGCaaGCGGCCGCaaGCGGCCGCaaGCGGCCGC', true);
    addSource('RestrictionAndLigationSource');
    clickMultiSelectOption('Enzymes used', 'NotI', '.open-cloning');
    clickMultiSelectOption('Assembly inputs', 'Select all', '.open-cloning');
    cy.get('li#source-4 button').contains('Submit').click();
    cy.get('.submit-backend-api .loading-progress').should('not.exist', { timeout: 20000 });
    cy.get('.MuiAlert-message').contains('Too many assemblies');
  });
  it('displays warnings when server returns them', () => {
    manuallyTypeSequence('aaGAATTCaaGATATCaaGAATTCaaGAATTCaa');
    addLane();
    manuallyTypeSequence('CCCCGAATTCCCC', true);
    addSource('RestrictionAndLigationSource');
    clickMultiSelectOption('Enzymes used', 'EcoRI', 'li#source-3');
    clickMultiSelectOption('Enzymes used', 'EcoRV', 'li#source-3');
    clickMultiSelectOption('Assembly inputs', '2', 'li#source-3');
    cy.get('li#source-3 button').contains('Submit').click();
    cy.get('.submit-backend-api .loading-progress').should('not.exist', { timeout: 20000 });
    cy.get('#global-error-message-wrapper .MuiAlert-message', { timeout: 20000 }).contains('partially digested products');

    closeAlerts();
    deleteSourceByContent('Manually typed')
    deleteSourceByContent('Manually typed')
    addLane();

    manuallyTypeSequence('aaGAATTCaaGATATCaaGAATTCaa');
    addLane();
    manuallyTypeSequence('cccGAATTCccc', true);
    addSource('RestrictionAndLigationSource');
    clickMultiSelectOption('Enzymes used', 'EcoRI', 'li#source-3');
    clickMultiSelectOption('Enzymes used', 'EcoRV', 'li#source-3');
    clickMultiSelectOption('Assembly inputs', '2', 'li#source-3');
    cy.get('li#source-3 button').contains('Submit').click();
    cy.get('.submit-backend-api .loading-progress').should('not.exist', { timeout: 20000 });
    cy.get('li#source-3 .MuiAlert-message').contains('No compatible restriction-ligation');
    cy.get('#global-error-message-wrapper .MuiAlert-message', { timeout: 20000 }).contains('partially digested products');
  });
});
