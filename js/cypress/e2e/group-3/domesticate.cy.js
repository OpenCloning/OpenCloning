import { loadExample, setInputValue } from '../common_functions';

describe('Domesticate flow', () => {
  beforeEach(() => {
    cy.visit('/');
    cy.viewport(1920, 1080);
  });

  it.skip('opens domesticate dialog from ase1 and submits', () => { // allow-skip: external GoldenBraid service used by the backend is down
    loadExample('Integration of cassette by homologous recombination');

    // Show sequence id 3 in the main sequence editor
    cy.get('li#sequence-3 svg[data-testid="VisibilityIcon"]').click();
    cy.get('.main-sequence-editor').contains('CU329670').should('exist');
    cy.contains('svg', 'ase1').first().should('be.visible');

    // Right-click ase1 feature and open the domesticate dialog
    cy.contains('.veLabelText', 'ase1').trigger("contextmenu", { force: true });
    cy.get('a.bp3-menu-item').contains('Domesticate (experimental)').click();
    cy.get('.MuiDialog-root').contains('Domesticate (experimental)').should('be.visible');

    // Fill minimum required fields for a valid submit
    setInputValue('Part name', 'ase1_domesticated', '.MuiDialog-root');
    setInputValue('Prefix', 'ATGC', '.MuiDialog-root');
    setInputValue('Suffix', 'CGTA', '.MuiDialog-root');

    // Submit dialog and verify request + close
    cy.intercept('POST', '**/batch_cloning/domesticate*').as('batchDomesticate');
    cy.get('.MuiDialog-root button').contains('Submit').should('not.be.disabled').click();
    cy.wait('@batchDomesticate');
    cy.get('.MuiDialog-root').should('not.exist');

    // Check we moved to the cloning tab
    cy.get('button.MuiTab-root.Mui-selected').contains('Cloning').should('exist');
    // Check the sequence is updated
    cy.get('li#sequence-3').should('have.length', 2);
    cy.get('li').contains('Restriction with BsaI and BsmBI').should('exist');
  });
});
