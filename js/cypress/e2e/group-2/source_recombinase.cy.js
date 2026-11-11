import { addLane, addSource, clickMultiSelectOption, setInputValue, manuallyTypeSequence } from '../common_functions';

describe('Recombinase', () => {
  beforeEach(() => {
    cy.visit('/');
  });

  it('adds recombinase and submits with compatible sequences', () => {
    // From Python test: site1=AAaaTTC, site2=CCaaGC; sequences contain these sites
    manuallyTypeSequence('gggAAaaTTCaaattt');
    addLane();
    manuallyTypeSequence('cccCCaaGCtttaaa', true);
    addSource('RecombinaseSource');

    setInputValue('Site 1', 'AAaaTTC', 'div.assembly');
    setInputValue('Site 2', 'CCaaGC', 'div.assembly');
    cy.get('div.assembly button').contains('Add recombinase').click();
    clickMultiSelectOption('Assembly inputs', 'Select all', 'li');
    cy.intercept('POST', '**/recombinase*').as('recombinaseRequest');
    cy.get('div.assembly button').contains('Submit').click();
    cy.wait('@recombinaseRequest').then((interception) => {
      expect(interception.request.query.input_contains_genome).to.equal('true');
    });
    cy.get('li#sequence-3 li#source-3', { timeout: 20000 }).should('exist');
  });

  it('gives the right error when sequences are not compatible', () => {
    manuallyTypeSequence('aagaattcaaaagaattcaa');
    addLane();
    manuallyTypeSequence('tagatatca');
    addSource('RecombinaseSource');

    setInputValue('Site 1', 'AAaaTTC', 'div.assembly');
    setInputValue('Site 2', 'CCaaGC', 'div.assembly');
    cy.get('div.assembly button').contains('Add recombinase').click();
    clickMultiSelectOption('Assembly inputs', 'Select all', 'li');
    cy.get('div.assembly button').contains('Submit').click();
    cy.get('li .MuiAlert-message', { timeout: 20000 }).should('contain', 'No compatible reaction');
  });

  it('applies the input_contains_genome parameter correctly based on the input sequences', () => {
    manuallyTypeSequence('gggAAaaTTCaaattt');
    addLane();
    manuallyTypeSequence('cccCCaaGCtttaaa', true);
    addSource('RecombinaseSource');
    setInputValue('Site 1', 'AAaaTTC', 'div.assembly');
    setInputValue('Site 2', 'CCaaGC', 'div.assembly');
    cy.get('div.assembly button').contains('Add recombinase').click();

    cy.get('.input-contains-genome-checkbox').should('not.exist');
    clickMultiSelectOption('Assembly inputs', '2', 'li');
    cy.get('[data-testid="input-contains-genome-checkbox"]').should('exist');
    cy.get('[data-testid="input-contains-genome-checkbox"] input').should('be.checked');
    cy.get('[data-testid="input-contains-genome-checkbox"]').click();
    cy.get('[data-testid="input-contains-genome-checkbox"] input').should('not.be.checked');

    cy.intercept('POST', '**/recombinase*').as('recombinaseRequest');
    cy.get('div.assembly button').contains('Submit').click();
    cy.wait('@recombinaseRequest').then((interception) => {
      expect(interception.request.query.input_contains_genome).to.equal('false');
    });
    cy.get('.MuiAlert-message', { timeout: 20000 }).should('contain', 'No compatible reaction');
    clickMultiSelectOption('Assembly inputs', '1', 'li');
    cy.get('[data-testid="input-contains-genome-checkbox"]').should('not.exist');
  });
});
