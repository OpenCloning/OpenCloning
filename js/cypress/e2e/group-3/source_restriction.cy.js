import { manuallyTypeSequence, addSource, clickMultiSelectOption, waitForEnzymes } from '../common_functions';

describe('Test restriction component', () => {
  beforeEach(() => {
    cy.visit('/');
  });
  it('Works with single enzyme', () => {
    manuallyTypeSequence('aagaattcaaaagaattcaa');
    addSource('RestrictionEnzymeDigestionSource');
    waitForEnzymes('li#source-2');
    // Click the selector
    clickMultiSelectOption('Enzymes used', 'EcoRI', 'li#source-2');
    // Cut with EcoRI
    cy.get('button').contains('Perform restriction').click();
    // Contains both the parent with the subset, and the child with the result
    cy.get('li#source-2').contains('20 bps');
    cy.get('li#source-2').contains('7 bps');
    cy.get('li#source-2 .overhang-representation').contains('ttcttaa');
    // The subset is shown
    cy.get('li#source-2 .multiple-output-selector .veSelectionLayer').should('exist');
    cy.get('li#source-2 .multiple-output-selector [title="Selecting 8 bps from 1 to 8"]');
    // Clicking on the buttons should change the selection (we move back)
    cy.get('li#source-2 .multiple-output-selector [data-testid="ArrowBackIcon"]').click();
    cy.get('li#source-2 .overhang-representation').contains('ttcttaa').should('not.exist');
    cy.get('li#source-2 .overhang-representation').contains('aattcaa');
    // We select the central fragment
    cy.get('li#source-2 .multiple-output-selector [data-testid="ArrowBackIcon"]').click();
    cy.get('li#source-2 .overhang-representation').contains('aattcaaaag');
    cy.get('li#source-2 .overhang-representation').contains('gttttcttaa');
    cy.get('button').contains('Choose product').click();
    // The result is shown
    cy.get('li#sequence-2 li#source-2').should('exist');
    cy.get('li#sequence-2 li#source-2').contains('Restriction with EcoRI');
    cy.get('li#sequence-2', { timeout: 20000 }).contains('14 bps');
  });
  it('works with multiple enzymes', () => {
    manuallyTypeSequence('aagaattcaaaaGTCGACaa');
    addSource('RestrictionEnzymeDigestionSource');
    // Select the enzymes and submit
    waitForEnzymes('li#source-2');
    clickMultiSelectOption('Enzymes used', 'EcoRI', 'li#source-2');
    clickMultiSelectOption('Enzymes used', 'SalI', 'li#source-2');
    cy.get('button').contains('Perform restriction').click();
    // The result is shown and there are 3 possible fragments (both enzymes were sent)
    cy.get('li#source-2 .overhang-representation').contains('ttcttaa');
    cy.get('li#source-2 .multiple-output-selector [data-testid="ArrowForwardIcon"]').click();
    cy.get('li#source-2 .overhang-representation').contains('gttttcagct');
    cy.get('li#source-2 .multiple-output-selector [data-testid="ArrowForwardIcon"]').click();
    cy.get('li#source-2 .overhang-representation').contains('tcgacaa');
    cy.get('li#source-2 .multiple-output-selector [data-testid="ArrowForwardIcon"]').click();
    cy.get('li#source-2 .overhang-representation').contains('ttcttaa');

    // We select the first fragment (only EcoRI)
    cy.get('button').contains('Choose product').click();
    // The result is shown
    cy.get('li#sequence-2 li#source-2').should('exist');
    cy.get('li#sequence-2 li#source-2').contains('Restriction with EcoRI');
    cy.get('li#sequence-2 .overhang-representation').contains('ttcttaa');
  });
  it('does not show choices if there is one possible output', () => {
    manuallyTypeSequence('aagaattcaaaa', true);
    addSource('RestrictionEnzymeDigestionSource');
    // Cut with EcoRI
    waitForEnzymes('li#source-2');
    clickMultiSelectOption('Enzymes used', 'EcoRI', 'li#source-2');
    cy.get('button').contains('Perform restriction').click();
    // Directly displays the result
    cy.get('li#sequence-2 li#source-2').should('exist');
    cy.get('li#sequence-2 .overhang-representation').contains('aattcaaaaaag');
  });
  it('applies the right constraints', () => {
    manuallyTypeSequence('aagaattcaaaaGTCGACaa');
    addSource('RestrictionEnzymeDigestionSource');
    // Before selecting an enzyme, you cannot submit
    cy.get('button').contains('Perform restriction').should('not.exist');
  });
  it('allows re-restriction', () => {
    manuallyTypeSequence('aagaattcaaaaGTCGACaa');
    addSource('RestrictionEnzymeDigestionSource');
    // Select the enzymes and submit
    waitForEnzymes('li#source-2');
    clickMultiSelectOption('Enzymes used', 'EcoRI', 'li#source-2');
    cy.get('button').contains('Perform restriction').click();
    // The cut shown is EcoRI
    cy.get('li#source-2 .overhang-representation').contains('ttcttaa');
    // Unselect EcoRI and select SalI
    clickMultiSelectOption('Enzymes used', 'EcoRI', 'li#source-2');
    clickMultiSelectOption('Enzymes used', 'SalI', 'li#source-2');
    cy.get('button').contains('Perform restriction').click();
    // The cut shown is SalI
    cy.get('li#source-2 .overhang-representation', { timeout: 20000 }).contains('TTCTT...TTTTCAGCT');
    // Select this cut
    cy.get('button').contains('Choose product').click();
    // The result is shown
    cy.get('li#sequence-2 li#source-2', { timeout: 20000 }).should('exist');
    cy.get('li#sequence-2 .overhang-representation').contains('TTCTT...TTTTCAGCT');
  });
  it('shows the right error if the enzyme does not cut', () => {
    // Type the sequence
    manuallyTypeSequence('aagaattcaaaaGTCGACaa');
    addSource('RestrictionEnzymeDigestionSource');
    // Select the enzymes and submit
    waitForEnzymes('li#source-2');
    clickMultiSelectOption('Enzymes used', 'AanI', 'li#source-2');
    clickMultiSelectOption('Enzymes used', 'AatII', 'li#source-2');
    cy.get('button').contains('Perform restriction').click();
    // The cut shown is EcoRI
    cy.get('li#source-2').contains('These enzymes do not cut');
  });
  it('shows the right error if the backend server fails', () => {
    manuallyTypeSequence('aagaattcaaaaGTCGACaa');
    addSource('RestrictionEnzymeDigestionSource');
    waitForEnzymes('li#source-2');
    // Select the enzymes and submit
    clickMultiSelectOption('Enzymes used', 'EcoRI', 'li#source-2');
    // Intercept the request
    // simulate backend not connected
    cy.intercept('POST', '/restriction*', { forceNetworkError: true });
    cy.get('button').contains('Perform restriction').click();
    cy.get('li#source-2').contains('Cannot connect to backend server');
  });
});
