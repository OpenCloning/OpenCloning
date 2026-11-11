import React from 'react';
import GetSequencesInBulkComponent from './GetSequencesInBulkComponent';
import { clickMultiSelectOption } from '../../../cypress/e2e/common_functions';
import endpoints from './endpoints';
import { formatSequenceName } from './common';

const SEQUENCE_NAME = 'ase1_CDS_PCR';
const TAG_NAME = 'gibson_assembly';

function expectLoadedSequences(spy, stubBody) {
  expect(spy).to.have.been.calledOnce;
  const [sequences] = spy.lastCall.args;
  expect(sequences).to.deep.equal(stubBody.map(({ sequence_ref, sequence }) => ({
    databaseId: sequence_ref.id,
    name: formatSequenceName(sequence_ref),
    seguid: sequence_ref.seguid,
    textFileSequence: sequence,
  })));
}

describe('<GetSequencesInBulkComponent />', () => {
  beforeEach(() => {
    cy.setupOpenCloningDBTestAuth();
    // TagMultiSelect fetches the tags on mount, in every test
    cy.interceptOpenCloningDBStub('get_tags', { alias: 'getTags' });
  });

  it('loads all sequences with a tag', () => {
    const onSequencesLoadedSpy = cy.spy().as('onSequencesLoadedSpy');
    cy.interceptOpenCloningDBStub('get_text_file_sequences_by_tag', { alias: 'getSequences' });

    cy.mount(<GetSequencesInBulkComponent onSequencesLoaded={onSequencesLoadedSpy} />);

    cy.contains('button', 'Load sequences').should('be.disabled');
    cy.wait('@getTags');
    clickMultiSelectOption('Tags', TAG_NAME, 'div');
    cy.contains('button', 'Load sequences').click();
    cy.wait('@getSequences');

    cy.getStub('get_text_file_sequences_by_tag').then((stub) => {
      expect(stub.response.body).to.have.length.greaterThan(1);
      cy.get('@onSequencesLoadedSpy').should((spy) => expectLoadedSequences(spy, stub.response.body));
    });
  });

  it('loads the picked sequences', () => {
    const onSequencesLoadedSpy = cy.spy().as('onSequencesLoadedSpy');
    cy.interceptOpenCloningDBStub('get_sequences_search_by_name', { alias: 'searchByName' });
    cy.interceptOpenCloningDBStub('get_sequences_search_by_name_uid_query', { alias: 'searchByUid' });
    cy.interceptOpenCloningDBStub('get_text_file_sequences_by_ids', { alias: 'getSequences' });

    cy.mount(<GetSequencesInBulkComponent onSequencesLoaded={onSequencesLoadedSpy} />);

    cy.contains('button', 'Pick sequences').click();
    cy.contains('button', 'Load sequences').should('be.disabled');
    cy.get('input').type(SEQUENCE_NAME);
    cy.wait('@searchByName');
    clickMultiSelectOption('Sequences', RegExp(`^${SEQUENCE_NAME}$`), 'div');
    cy.contains('button', 'Load sequences').click();
    cy.wait('@getSequences');

    cy.getStub('get_text_file_sequences_by_ids').then((stub) => {
      cy.get('@onSequencesLoadedSpy').should((spy) => expectLoadedSequences(spy, stub.response.body));
    });
  });

  it('shows the error returned by the server', () => {
    const onSequencesLoadedSpy = cy.spy().as('onSequencesLoadedSpy');
    cy.intercept('GET', `**${endpoints.sequenceTextFiles}*`, {
      statusCode: 400,
      body: { detail: 'Too many sequences (300), the maximum is 200.' },
    }).as('getSequences');

    cy.mount(<GetSequencesInBulkComponent onSequencesLoaded={onSequencesLoadedSpy} />);

    cy.wait('@getTags');
    clickMultiSelectOption('Tags', TAG_NAME, 'div');
    cy.contains('button', 'Load sequences').click();
    cy.wait('@getSequences');
    cy.get('.MuiAlert-colorError').contains('Too many sequences (300), the maximum is 200.').should('exist');
    cy.get('@onSequencesLoadedSpy').should('not.have.been.called');
  });

  it('shows a message when no sequences have the tag', () => {
    const onSequencesLoadedSpy = cy.spy().as('onSequencesLoadedSpy');
    cy.intercept('GET', `**${endpoints.sequenceTextFiles}*`, { statusCode: 200, body: [] }).as('getSequences');

    cy.mount(<GetSequencesInBulkComponent onSequencesLoaded={onSequencesLoadedSpy} />);

    cy.wait('@getTags');
    clickMultiSelectOption('Tags', TAG_NAME, 'div');
    cy.contains('button', 'Load sequences').click();
    cy.wait('@getSequences');
    cy.contains('No sequences found with the selected tags.').should('exist');
    cy.get('@onSequencesLoadedSpy').should('not.have.been.called');
  });

  it('shows a message when the picked sequences have no content', () => {
    const onSequencesLoadedSpy = cy.spy().as('onSequencesLoadedSpy');
    cy.interceptOpenCloningDBStub('get_sequences_search_by_name', { alias: 'searchByName' });
    cy.interceptOpenCloningDBStub('get_sequences_search_by_name_uid_query', { alias: 'searchByUid' });
    cy.intercept('GET', `**${endpoints.sequenceTextFiles}*`, { statusCode: 200, body: [] }).as('getSequences');

    cy.mount(<GetSequencesInBulkComponent onSequencesLoaded={onSequencesLoadedSpy} />);

    cy.contains('button', 'Pick sequences').click();
    cy.get('input').type(SEQUENCE_NAME);
    cy.wait('@searchByName');
    clickMultiSelectOption('Sequences', RegExp(`^${SEQUENCE_NAME}$`), 'div');
    cy.contains('button', 'Load sequences').click();
    cy.wait('@getSequences');
    cy.contains('The selected sequences have no content (template sequences cannot be loaded).').should('exist');
    cy.contains('No sequences found with the selected tags.').should('not.exist');
    cy.get('@onSequencesLoadedSpy').should('not.have.been.called');
  });
});
