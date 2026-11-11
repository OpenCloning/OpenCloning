import { addLane, addSource, clickMultiSelectOption, manuallyTypeSequence } from '../common_functions';

describe('Test polymerase extension functionality', () => {
  beforeEach(() => {
    cy.visit('/');
  });

  it('performs polymerase extension correctly and applies the right constraints', () => {
    // Add first sequence
    manuallyTypeSequence('ACGTACGT');
    addSource('PolymeraseExtensionSource');
    // Should show an alert since there are no overhangs
    cy.get('.MuiAlert-message').contains('Invalid input');

    // Add second sequence with wrong overhangs
    addLane();
    manuallyTypeSequence('GCGCACGT', false, [3, 3]);
    addSource('PolymeraseExtensionSource');
    // Should show an alert since there are no overhangs
    cy.get('li#source-4 .MuiAlert-message').contains('Invalid input');

    // Add third sequence with correct overhangs
    addLane();
    manuallyTypeSequence('GCGCACGT', false, [-3, -3]);
    addSource('PolymeraseExtensionSource');
    cy.get('li#source-6 button').contains('Extend with').click();
    cy.get('li#sequence-6').should('exist');
    cy.get('li#sequence-6 > span .overhang-representation').should('not.exist');
  });
});
