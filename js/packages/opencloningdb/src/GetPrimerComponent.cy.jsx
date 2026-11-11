import React from 'react';
import GetPrimerComponent from './GetPrimerComponent';
import { clickMultiSelectOption } from '../../../cypress/e2e/common_functions';

const PRIMER_NAME = 'lacZ_attB1_fwd';

describe('<GetPrimerComponent />', () => {
  it('successfully selects a primer and calls setPrimer with correct data', () => {
    const setPrimerSpy = cy.spy().as('setPrimerSpy');
    const setErrorSpy = cy.spy().as('setErrorSpy');
    cy.setupOpenCloningDBTestAuth();

    cy.interceptOpenCloningDBStub('get_primers_search_by_name', { alias: 'getPrimers' });
    cy.interceptOpenCloningDBStub('get_primer', { alias: 'getPrimer' });

    cy.mount(<GetPrimerComponent setPrimer={setPrimerSpy} setError={setErrorSpy} />);

    cy.get('input').type(PRIMER_NAME);
    cy.get('.MuiAutocomplete-listbox li', { timeout: 10000 }).should('have.length.greaterThan', 0);
    cy.wait('@getPrimers');

    clickMultiSelectOption('Primer', PRIMER_NAME, 'div');

    cy.getStub('get_primer').then((stub) => {
      cy.wait('@getPrimer');
      cy.get('@setPrimerSpy').should('have.been.calledWithMatch', {
        name: stub.response.body.name,
        sequence: stub.response.body.sequence,
        'database_id': stub.response.body.id,
      });
    });
    cy.get('@setErrorSpy').should('have.been.calledWith', '');
  });

  it('clears primer and error when selection is cleared', () => {
    const setPrimerSpy = cy.spy().as('setPrimerSpy');
    const setErrorSpy = cy.spy().as('setErrorSpy');
    cy.setupOpenCloningDBTestAuth();

    cy.interceptOpenCloningDBStub('get_primers_search_by_name', { alias: 'getPrimers' });
    cy.interceptOpenCloningDBStub('get_primer', { alias: 'getPrimer' });

    cy.mount(<GetPrimerComponent setPrimer={setPrimerSpy} setError={setErrorSpy} />);

    cy.get('input').type(PRIMER_NAME);
    cy.get('.MuiAutocomplete-listbox li', { timeout: 10000 }).should('have.length.greaterThan', 0);
    cy.wait('@getPrimers');
    clickMultiSelectOption('Primer', PRIMER_NAME, 'div');
    cy.wait('@getPrimer');
    cy.get('@setPrimerSpy').should('have.been.calledWithMatch', { name: PRIMER_NAME });

    cy.get('.MuiAutocomplete-clearIndicator').click();

    cy.get('@setPrimerSpy').should('have.been.calledWith', null);
    cy.get('@setErrorSpy').should('have.been.calledWith', '');
  });
});
