import { addSource, clickMultiSelectOption } from '../common_functions';
describe('Local File Source', () => {

  beforeEach(() => {
    cy.visit('/');
    addSource('LocalFileSource', 1);
  });
  it('works on normal case', () => {
    clickMultiSelectOption('Sequence', 'seq1', 'li#source-1');
    cy.get('button.MuiButtonBase-root').contains('Submit').click();
    cy.get('li#sequence-1', { timeout: 20000 }).contains('seq1');
    cy.get('li#sequence-1 li#source-1').contains('Read from file sequences/seq1.gb');
    cy.get('li#sequence-1').contains('5 bps');
  });
  it('Shows error when backend request fails', () => {
    cy.intercept('POST', 'http://127.0.0.1:8000/read_from_file', { statusCode: 500 }).as('readFromFile');
    clickMultiSelectOption('Sequence', 'seq1', 'li#source-1');
    cy.get('button.MuiButtonBase-root').contains('Submit').click();
    cy.get('li#source-1 .MuiAlert-message').contains('Internal server error');
  });
});
