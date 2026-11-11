import { addLane, changeTab, manuallyTypeSequence } from '../common_functions';

describe('Test verification files', () => {
  beforeEach(() => {
    cy.visit('/');
  });

  it('Can upload sequencing files', () => {
    cy.get('.MuiToolbar-root .MuiButtonBase-root').contains('File').siblings('input').selectFile('cypress/test_files/cloning_strategy_with_sequencing.json', { force: true });
    cy.get('#sequence-1 svg[data-testid="RuleIcon"]').click();

    cy.get('button').contains('Submit files').click();
    // Add sequencing files
    cy.get('.verification-file-dialog input[type="file"]').selectFile([
      'cypress/test_files/sequencing/BZO902-13409020-13409020.ab1',
      'cypress/test_files/dummy_sequencing.fasta',
      'cypress/test_files/dummy_sequencing.gb',
    ], { force: true });
    // Verify files are added
    cy.get('.verification-file-dialog table').contains('BZO902-13409020-13409020.ab1', { timeout: 10000 });
    cy.get('.verification-file-dialog table').contains('dummy_sequencing.fasta');
    cy.get('.verification-file-dialog table').contains('dummy_sequencing.gb');
    cy.get('.verification-file-dialog table tr').should('have.length', 4);
    cy.get('.verification-file-dialog button').contains('Close').click();

    // Verify files are visible in the alignment tab
    cy.get('li#sequence-1 svg[data-testid="VisibilityIcon"]').click();
    cy.get('div.veTabActive.veTabAlignments').should('be.visible');
    cy.get('div.alignmentTrackNameDiv').contains('BZO902-13409020-13409020.ab1').should('exist');
    cy.get('div.alignmentTrackNameDiv').contains('dummy_sequencing.fasta').should('exist');
    cy.get('div.alignmentTrackNameDiv').contains('dummy_sequencing.gb').should('exist');

    // Go back to the Cloning tab, create a dummy sequence and view it (change main sequence)
    changeTab('Cloning');
    addLane();
    manuallyTypeSequence('ATGC', false);
    cy.get('li#sequence-2 svg[data-testid="VisibilityIcon"]').click();

    changeTab('Cloning');
    cy.get('#sequence-1 svg[data-testid="RuleIcon"]').click();
    cy.get('.verification-file-dialog button').contains('See alignments').click();
    cy.get('div.veTabActive.veTabAlignments').should('be.visible');
    cy.get('div.alignmentTrackNameDiv').contains('BZO902-13409020-13409020.ab1').should('exist');
    cy.get('div.alignmentTrackNameDiv').contains('dummy_sequencing.fasta').should('exist');
    cy.get('div.alignmentTrackNameDiv').contains('dummy_sequencing.gb').should('exist');
  });
});
