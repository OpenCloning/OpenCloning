import { addPrimer, addSource, clickMultiSelectOption, setInputValue, clickSequenceOutputArrow} from '../common_functions';

describe('Tests oligo hybridization source', () => {
  beforeEach(() => {
    cy.visit('/');
  });
  it('works in the normal case', () => {
    addPrimer('fwd-hyb', 'aaGCGGCCGCgtagaactttatgtgcttccttacattggt');
    addPrimer('rvs-hyb', 'aaGCGGCCGCaccaatgtaaggaagcacataaagttctac');
    addSource('OligoHybridizationSource', true);
    // Select the primers
    clickMultiSelectOption('Forward primer', 'fwd-hyb', 'li#source-1');
    clickMultiSelectOption('Reverse primer', 'rvs-hyb', 'li#source-1');
    // Submit
    cy.get('button').contains('Perform hybridization').click();
    // The result is shown
    cy.get('li#sequence-1', { timeout: 20000 }).contains('50 bps');
    cy.get('li#sequence-1 li#source-1').contains('Hybridization of primers fwd-hyb and rvs-hyb');
    // Cannot delete the primers
    cy.get('button.MuiTab-root').contains('Primers').click();
    cy.get('.primer-table-container [data-testid="DeleteIcon"]').first().click();
    cy.get('div.primer-table-container tbody tr').should('have.length', 2);
  });
  it('shows the submission button only after the primers are selected', () => {
    addPrimer('fwd-hyb', 'aaGCGGCCGCgtagaactttatgtgcttccttacattggt');
    addPrimer('rvs-hyb', 'aaGCGGCCGCaccaatgtaaggaagcacataaagttctac');
    addSource('OligoHybridizationSource', true);
    cy.get('button').contains('Perform hybridization').should('not.exist');
    // Select the primers
    clickMultiSelectOption('Forward primer', 'fwd-hyb', 'li#source-1');
    cy.get('button').contains('Perform hybridization').should('not.exist');
    clickMultiSelectOption('Reverse primer', 'rvs-hyb', 'li#source-1');
    cy.get('button').contains('Perform hybridization').should('exist');
  });
  it('gives the right error for no annealing', () => {
    addPrimer('fwd_test', 'CCCCCCCC');
    addPrimer('rvs_test', 'aaaaaaaa');
    addPrimer('fwd-hyb', 'aaGCGGCCGCgtagaactttatgtgcttccttacattggt');
    addPrimer('rvs-hyb', 'aaGCGGCCGCaccaatgtaaggaagcacataaagttctac');
    addSource('OligoHybridizationSource', true);
    clickMultiSelectOption('Forward primer', 'fwd_test', 'li#source-1');
    clickMultiSelectOption('Reverse primer', 'rvs_test', 'li#source-1');
    cy.get('button').contains('Perform hybridization').click();
    cy.get('.MuiAlert-message').contains('No pair of annealing oligos');
    clickMultiSelectOption('Forward primer', 'fwd-hyb', 'li#source-1');
    clickMultiSelectOption('Reverse primer', 'rvs-hyb', 'li#source-1');
    setInputValue('Minimal annealing length', '40', 'li#source-1');
    cy.get('button').contains('Perform hybridization').click();
    cy.get('.MuiAlert-message').contains('No pair of annealing oligos');
  });
  it('works with several options', () => {
    addPrimer('fwd-hyb', 'aaGCGGCCGCgtagaactttatgtgcttccttacattgaa');
    addPrimer('rvs-hyb', 'acGCGGCCGCttcaatgtaaggaagcacataaagttctac');
    addSource('OligoHybridizationSource', true);
    clickMultiSelectOption('Forward primer', 'fwd-hyb', 'li#source-1');
    clickMultiSelectOption('Reverse primer', 'rvs-hyb', 'li#source-1');

    setInputValue('Minimal annealing length', '8', 'li#source-1');
    cy.get('button').contains('Perform hybridization').click();
    cy.get('li#source-1').contains('50 bps', { timeout: 20000 });
    clickSequenceOutputArrow('li#source-1');
    cy.get('li#source-1').contains('68 bps');
    clickSequenceOutputArrow('li#source-1');
    cy.get('li#source-1').contains('50 bps');
    clickSequenceOutputArrow('li#source-1');
    cy.get('li#source-1').contains('68 bps');
    cy.get('button').contains('Choose product').click();
    cy.get('li#sequence-1 li#source-1').should('exist');
    cy.get('li#sequence-1').contains('68 bps');
  });
});
