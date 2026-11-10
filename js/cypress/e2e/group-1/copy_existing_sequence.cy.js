import { addLane, addSource, clickMultiSelectOption, deleteSourceByContent, loadExample, manuallyTypeSequence } from '../common_functions';

describe('Test copy existing sequence functionality', () => {
  beforeEach(() => {
    cy.visit('/');
  });
  it('Copies the correct sequence', () => {
    manuallyTypeSequence('ACGT');
    addLane();
    addSource('CopySequence', true);
    clickMultiSelectOption('Sequence to copy', '1', 'li#source-2');
    cy.get('button').contains('Copy sequence').click();
    cy.get('li#source-1').should('exist');
    cy.get('li#source-2').should('exist');

    // Deleting one does not delete the other
    deleteSourceByContent('typed');
    cy.get('li#source-2').should('exist');
    cy.get('li#sequence-2').should('exist');
    cy.get('li#source-1').should('not.exist');
    cy.get('li#sequence-1').should('not.exist');
  });
  it('Copies linked files', () => {
    cy.get('.MuiToolbar-root .MuiButtonBase-root').contains('File').siblings('input').selectFile('apps/opencloning/public/examples/cloning_strategy_with_sequencing.zip', { force: true });
    cy.get('div.cloning-tab-pannel').contains('final_product.gb');
    addLane();
    addSource('CopySequence', true);
    clickMultiSelectOption('Sequence to copy', '1', 'li#source-2');
    cy.get('button').contains('Copy sequence').click();
    cy.get('li#sequence-1').should('exist');
    cy.get('li#sequence-2').should('exist').then(() => {
      cy.window().its('verificationFileStore')
        .invoke('get', 'verification-2-BZO904_13409044_13409044.ab1')
        .should('not.be.null');
      cy.window().its('verificationFileStore').invoke('size').should('eq', 6);
    });
    cy.get('li#sequence-2 [data-testid="RuleIcon"]').click();
    cy.get('table').contains('BZO904_13409044_13409044.ab1');
    cy.get('table').contains('BZO903_13409037_13409037.ab1');
    cy.get('table').contains('BZO902_13409020_13409020.ab1');
  });
  it('Works for entries with PCRs', () => {
    // This one is important, because the references to the primers must also be copied.
    loadExample('Gibson assembly');
    addLane();
    addSource('CopySequence', true);
    cy.get('.sequenceNameText').filter(':contains("digested_vector")').should('have.length', 1);
    clickMultiSelectOption('Sequence to copy', 'digested_vector', 'li');
    cy.get('button').contains('Copy sequence').click();
    cy.get('.sequenceNameText span').filter(':contains("digested_vector")').should('have.length', 2);
  })
});
