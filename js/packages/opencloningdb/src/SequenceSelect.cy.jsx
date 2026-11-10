import React from 'react';
import endpoints from './endpoints';
import SequenceSelect from './SequenceSelect';
import { clickMultiSelectOption } from '../../../cypress/e2e/common_functions';

const SEQUENCE_NAME = 'ase1_CDS_PCR';
const SEQUENCE_UID = 'example_sequencing-sample';

describe('<SequenceSelect />', () => {
  it('searches for a sequence by name and shows results', () => {
    cy.setupOpenCloningDBTestAuth();
    const onChangeSpy = cy.spy().as('onChangeSpy');

    cy.interceptOpenCloningDBStub('get_sequences_search_by_name', { alias: 'getSequences' });
    cy.interceptOpenCloningDBStub('get_sequences_search_by_name_uid_query', { alias: 'getSequencesByUid' });

    cy.mount(
      <SequenceSelect label="Sequence" onChange={onChangeSpy} multiple={false} />
    );

    cy.get('input').click();
    cy.contains('Type at least').should('exist');
    cy.get('input').type(SEQUENCE_NAME);
    cy.get('.MuiAutocomplete-listbox li', { timeout: 10000 }).should('have.length.greaterThan', 0);

    clickMultiSelectOption('Sequence', RegExp(`^${SEQUENCE_NAME}$`), 'div');

    cy.getStub('get_sequences_search_by_name').then((stub) => {
      const stubSequence = stub.response.body.items.find((sequence) => sequence.name === SEQUENCE_NAME);
      cy.get('@onChangeSpy').should('have.been.calledWith', stubSequence);
    });

    cy.get('input').should('have.value', SEQUENCE_NAME);
  });
  it('searches for a sequence by uid and shows results', () => {
    cy.setupOpenCloningDBTestAuth();
    const onChangeSpy = cy.spy().as('onChangeSpy');

    cy.interceptOpenCloningDBStub('get_sequences_search_by_uid', { alias: 'getSequencesByUid' });
    cy.interceptOpenCloningDBStub('get_sequences_search_by_uid_name_query', { alias: 'getSequencesByName' });


    cy.mount(
      <SequenceSelect label="Sequence" onChange={onChangeSpy} multiple={false} />
    );
    cy.get('input').click();
    cy.contains('Type at least').should('exist');
    cy.get('input').type(SEQUENCE_UID);
    cy.get('.MuiAutocomplete-listbox li', { timeout: 10000 }).should('have.length.greaterThan', 0);

    // We need to incercept, because it will submit the value of combined name + uid which is not in a stub
    cy.intercept('GET', Cypress.getDbURL(endpoints.sequences, '*'), { statusCode: 200, body: { items: [] } }).as('getSequences2');
    clickMultiSelectOption('Sequence', SEQUENCE_UID, 'div');

    cy.getStub('get_sequences_search_by_uid').then((stub) => {
      const stubSequence = stub.response.body.items.find((sequence) => sequence.sample_uids.includes(SEQUENCE_UID));
      expect(stubSequence).to.exist;
      cy.get('@onChangeSpy').should('have.been.calledWith', stubSequence);
      cy.get('input').should('have.value', `${stubSequence.name} (${SEQUENCE_UID})`);
    });
  });
});
