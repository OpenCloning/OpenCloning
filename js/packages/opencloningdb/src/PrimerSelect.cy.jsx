import React from 'react';
import PrimerSelect from './PrimerSelect';
import { DatabaseProvider } from '@opencloning/ui/providers/DatabaseContext';
import OpenCloningDBInterface from './OpenCloningDBInterface';
import { clickMultiSelectOption } from '../../../cypress/e2e/common_functions';
import endpoints from './endpoints';

const PRIMER_NAME = 'lacZ_attB1_fwd';

describe('<PrimerSelect />', () => {
  it('searches for a primer and shows results', () => {
    cy.setupOpenCloningDBTestAuth();
    const primerSpy = cy.spy().as('primerSpy');

    cy.interceptOpenCloningDBStub('get_primers_search_by_name', {
      alias: 'getPrimers',
    })

    cy.mount(
      <DatabaseProvider value={OpenCloningDBInterface}>
        <PrimerSelect setPrimer={primerSpy} />
      </DatabaseProvider>
    );
    // Clicking on the input
    cy.get('input').click();
    cy.contains('Type at least').should('exist');
    cy.get('input').type(PRIMER_NAME);
    cy.get('.MuiAutocomplete-listbox li', { timeout: 10000 }).should('have.length.greaterThan', 0);

    clickMultiSelectOption('Primer', PRIMER_NAME, 'div');

    cy.getStub('get_primers_search_by_name').then((stub) => {
      const stubPrimer = stub.response.body.items.find((primer) => primer.name === PRIMER_NAME);
      cy.get('input').should('have.value', PRIMER_NAME);
      cy.get('@primerSpy').should('have.been.calledWith', stubPrimer);
    });
  });

  it('shows an error message when the request fails', () => {
    cy.intercept('GET', Cypress.getDbURL(endpoints.primers, '*'), { statusCode: 500 }).as('getPrimers');
    cy.mount(
      <DatabaseProvider value={OpenCloningDBInterface}>
        <PrimerSelect setPrimer={cy.stub()} />
      </DatabaseProvider>
    );
    cy.get('input').type('ase1');
    cy.wait('@getPrimers');
    cy.contains('Could not retrieve primers from OpenCloningDB').should('exist');
    cy.contains('button', 'Retry').should('exist');
  });
});
