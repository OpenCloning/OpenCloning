import { addSource, manuallyTypeSequence, clickMultiSelectOption, deleteSourceById, setInputValue, addPrimer } from '../common_functions';

const homology1 = 'ATGCAAACAGTAATGATGGATGACATTCAAAGCACTGATT';
const homology2 = 'GTTTGCATCATTACTACCTACTGTAAGTTTCGTGACTAAA';
const guideRNASeq = 'CATTCAAAGCACTGATTaat';

describe('Tests homologous recombination and CRISPR functionality', () => {
  beforeEach(() => {
    cy.visit('/');
  });
  it('works in the normal case', () => {
    manuallyTypeSequence(`aaaaaa${homology1}aattggaa${homology2}tttttttt`);
    cy.get('svg[data-testid="AddCircleIcon"]', { timeout: 20000 }).last().click();
    manuallyTypeSequence(`${homology1}acaa${homology2}`);
    // Add gRNA
    addPrimer('gRNA-1', guideRNASeq);

    ['CRISPRSource', 'HomologousRecombinationSource'].forEach((sourceType) => {
      addSource(sourceType);
      clickMultiSelectOption('Insert sequence', '2', 'li#source-4');
      if (sourceType === 'CRISPRSource') {
        clickMultiSelectOption('Select gRNAs', 'gRNA-1', 'li#source-4');
      }
      cy.get('li#source-4 button.submit-backend-api').click();
      cy.get('li#sequence-4 li#source-4').should('exist');
      cy.get('li#sequence-4').contains('98 bps');
      deleteSourceById(4);
    });
  });
  it('works with multiple options', () => {
    manuallyTypeSequence(`aaaaaa${homology1}aattggaa${homology1}tttttttt`);
    cy.get('svg[data-testid="AddCircleIcon"]', { timeout: 20000 }).last().click();
    manuallyTypeSequence(`${homology1}acaa${homology1}`, true);
    // Add gRNA
    addPrimer('gRNA-1', guideRNASeq);

    ['CRISPRSource', 'HomologousRecombinationSource'].forEach((sourceType) => {
      addSource(sourceType);
      clickMultiSelectOption('Insert sequence', '2', 'li#source-4');
      if (sourceType === 'CRISPRSource') {
        clickMultiSelectOption('Select gRNAs', 'gRNA-1', 'li#source-4');
      }
      cy.get('li#source-4 button.submit-backend-api').click();
      cy.get('li#source-4 .multiple-output-selector', { timeOut: 2000 }).should('exist');
      cy.get('li#source-4 button').contains('Choose product').click();
      cy.get('li#sequence-4 li#source-4').should('exist');
      deleteSourceById(4);
    });

    // Shows multiple options
  });
  it('allows resubmission changing options, and gives error if not enough homology', () => {
    manuallyTypeSequence(`aaaaaa${homology1}aattggaa${homology1}tttttttt`);
    cy.get('svg[data-testid="AddCircleIcon"]', { timeout: 20000 }).last().click();
    manuallyTypeSequence(`${homology1}acaa${homology1}`, true);
    // Add gRNA
    addPrimer('gRNA-1', guideRNASeq);

    ['CRISPRSource', 'HomologousRecombinationSource'].forEach((sourceType) => {
      addSource(sourceType);
      clickMultiSelectOption('Insert sequence', '2', 'li#source-4');
      if (sourceType === 'CRISPRSource') {
        clickMultiSelectOption('Select gRNAs', 'gRNA-1', 'li#source-4');
      }
      cy.get('li#source-4 button.submit-backend-api').click();
      cy.get('li#source-4 .multiple-output-selector', { timeOut: 2000 }).should('exist');
      setInputValue('Minimal homology length', '80', 'li#source-4');
      cy.get('li#source-4 button.submit-backend-api').click();
      cy.get('li#source-4 .MuiAlert-message', { timeOut: 2000 }).should('exist');
      deleteSourceById(4);
    });
  });
  it('CRISPr shows the right error when RNA doesnt cut or cuts outside', () => {
    manuallyTypeSequence(`CTTTACACCTATGTATGAAGtgg${homology1}aattggaa${homology2}tttttttt`);
    cy.get('svg[data-testid="AddCircleIcon"]', { timeout: 20000 }).last().click();
    manuallyTypeSequence(`${homology1}acaa${homology2}`);

    addSource('CRISPRSource');
    clickMultiSelectOption('Insert sequence', '2', 'li#source-3');

    // Add gRNAs
    addPrimer('gRNA-cut-outside', 'CTTTACACCTATGTATGAAG');
    addPrimer('gRNA-no-cut', 'CTTTACACCCTATGTATGAAG');

    // Test gRNA that cuts outside
    clickMultiSelectOption('Select gRNAs', 'gRNA-cut-outside', 'li#source-3');
    cy.get('li#source-3 button.submit-backend-api').click();
    cy.get('li#source-3 .MuiAlert-message', { timeOut: 2000 }).contains('suitable products');

    // Test gRNA that doesn't cut (even if one that cuts is passed as well)
    clickMultiSelectOption('Select gRNAs', 'gRNA-no-cut', 'li#source-3');
    cy.get('li#source-3 button.submit-backend-api').click();
    cy.get('li#source-3 .MuiAlert-message', { timeOut: 2000 }).contains('Could not find Cas9 cutsite');
  });
  it('displays errors when server fails', () => {
    manuallyTypeSequence(`aaaaaa${homology1}aattggaa${homology2}tttttttt`);
    cy.get('svg[data-testid="AddCircleIcon"]', { timeout: 20000 }).last().click();
    manuallyTypeSequence(`${homology1}acaa${homology2}`);
    // Add gRNA
    addPrimer('gRNA-1', guideRNASeq);

    ['CRISPRSource', 'HomologousRecombinationSource'].forEach((sourceType) => {
      addSource(sourceType);
      clickMultiSelectOption('Insert sequence', '2', 'li#source-4');
      if (sourceType === 'CRISPRSource') {
        clickMultiSelectOption('Select gRNAs', 'gRNA-1', 'li#source-4');
      }
      cy.intercept('POST', 'http://127.0.0.1:8000/*', { forceNetworkError: true }).as('interc');
      cy.get('li#source-4 button.submit-backend-api').click();
      cy.get('li#source-4 .MuiAlert-message').contains('Cannot connect');

      cy.intercept('POST', 'http://127.0.0.1:8000/*', { statusCode: 500 }).as('interc2');
      cy.get('li#source-4 button.submit-backend-api').click();
      cy.get('li#source-4 .MuiAlert-message').contains('Internal server error');
      deleteSourceById(4);
    });
  });
});
