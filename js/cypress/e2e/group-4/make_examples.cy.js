import { addSource, clickMultiSelectOption, setInputValue, addPrimer, addLane } from '../common_functions';

describe('Makes all examples', () => {
  beforeEach(() => {
    cy.visit('/');
  });
  it('Homologous recombination', () => {
    // Load addgene plasmid
    addSource('RepositoryIdSource', true);
    clickMultiSelectOption('Select repository', 'Addgene', 'li#source-1');
    setInputValue('Addgene ID', '19342', 'li#source-1');
    cy.get('button.MuiButtonBase-root').contains('Submit').click();
    cy.get('li#sequence-1', { timeout: 20000 }).should('exist');
    // Do a pcr on it
    addPrimer('fwd', 'AGTTTTCATATCTTCCTTTATATTCTATTAATTGAATTTCAAACATCGTTTTATTGAGCTCATTTACATCAACCGGTTCACGGATCCCCGGGTTAATTAA');
    addPrimer('rvs', 'CTTTTATGAATTATCTATATGCTGTATTCATATGCAAAAATATGTATATTTAAATTTGATCGATTAGGTAAATAAGAAGCGAATTCGAGCTCGTTTAAAC');
    addSource('PCRSource');
    clickMultiSelectOption('Forward primer', 'fwd', 'li#source-4');
    clickMultiSelectOption('Reverse primer', 'rvs', 'li#source-4');
    cy.get('button').contains('Perform PCR').click();
    cy.get('.submit-backend-api .loading-progress').should('not.exist', { timeout: 20000 });
    // Load Ase1 sequence with some extra sequences on the sides
    addLane();
    addSource('GenomeCoordinatesSource', true);
    clickMultiSelectOption('Type of region', 'Locus in other assembly', 'li#source-5');
    cy.get('li#source-5 label', { timeout: 20000 }).contains('Assembly ID');
    setInputValue('Assembly ID', 'GCA_000002945.3', 'li#source-5');
    cy.get('li#source-5 label').contains('Species', { timeout: 20000 });
    setInputValue('Gene', 'ase1', 'li#source-5');
    cy.get('[role="presentation"]').contains('ASE1', { timeout: 20000, matchCase: false }).click();
    cy.get('li#source-5').contains('Submit').click();
    cy.get('li#sequence-5', { timeout: 20000 }).should('exist');
    // Do a homologous recombination
    addSource('HomologousRecombinationSource');
    clickMultiSelectOption('Template sequence', '5', 'li#source-6');
    clickMultiSelectOption('Insert sequence', '4', 'li#source-6');
    cy.get('li#source-6 button.submit-backend-api').click();
    cy.get('.MuiToolbar-root .MuiButtonBase-root').contains('File').click();
    cy.get('[role="menuitem"]').contains('Save cloning history to file').click();
    cy.get('button').contains('Save file').click();
    // Rename downloaded file
    cy.task('moveFile', {
      from: 'cypress/downloads/cloning_strategy.json',
      to: 'cypress/downloads/homologous_recombination.json',
    });
  });
  it('Restriction-ligation single step', () => {
    // Load Ase1 sequence with some extra sequences on the sides
    addSource('GenomeCoordinatesSource', true);
    clickMultiSelectOption('Type of region', 'Locus in other assembly', 'li#source-1');
    cy.get('li#source-1 label', { timeout: 20000 }).contains('Assembly ID');
    setInputValue('Assembly ID', 'GCA_000002945.3', 'li#source-1');
    cy.get('li#source-1 label').contains('Species', { timeout: 20000 });
    setInputValue('Gene', 'ase1', 'li#source-1');
    cy.get('[role="presentation"]').contains('ASE1', { timeout: 20000, matchCase: false }).click();
    cy.get('li#source-1').contains('Submit').click();
    cy.get('li#sequence-1', { timeout: 20000 }).should('exist');
    // Do a pcr on it
    addPrimer('fwd', 'TAAGCAGTCGACatgcaaacagtaatgatggatg');
    addPrimer('rvs', 'TAAGCAGGCGCGCCttaaaagccttcttctccccatt');
    addSource('PCRSource');
    clickMultiSelectOption('Forward primer', 'fwd', 'li#source-4');
    clickMultiSelectOption('Reverse primer', 'rvs', 'li#source-4');
    cy.get('button').contains('Perform PCR').click();
    cy.get('.submit-backend-api .loading-progress').should('not.exist', { timeout: 20000 });
    cy.get('li#sequence-4', { timeout: 20000 }).should('exist');

    // Load addgene plasmid
    addLane();
    addSource('RepositoryIdSource', true);
    clickMultiSelectOption('Select repository', 'Addgene', 'li#source-5');
    setInputValue('Addgene ID', '39296', 'li#source-5');
    cy.get('button.MuiButtonBase-root').contains('Submit').click();
    cy.get('li#sequence-5', { timeout: 20000 }).should('exist');

    // Do a restriction-ligation
    addSource('RestrictionAndLigationSource');
    clickMultiSelectOption('Assembly inputs', 'Select all', 'li#source-6');
    clickMultiSelectOption('Enzymes used', 'AscI', 'li#source-6');
    clickMultiSelectOption('Enzymes used', 'SalI', 'li#source-6');
    cy.get('li#source-6 button.submit-backend-api').click();
    cy.get('li#source-6').contains('Choose product', { timeout: 20000 }).click();
    cy.get('li#sequence-6', { timeout: 20000 }).contains('ase1').should('exist');
    cy.get('li#sequence-6').contains('kanMX').should('exist');
    cy.get('.MuiToolbar-root .MuiButtonBase-root').contains('File').click();
    cy.get('[role="menuitem"]').contains('Save cloning history to file').click();
    cy.get('button').contains('Save file').click();

    // Rename downloaded file
    cy.task('moveFile', {
      from: 'cypress/downloads/cloning_strategy.json',
      to: 'cypress/downloads/restriction_ligation_single_step.json',
    });
  });
});
