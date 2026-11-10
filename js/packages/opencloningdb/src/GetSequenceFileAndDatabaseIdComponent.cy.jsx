import React from 'react';
import GetSequenceFileAndDatabaseIdComponent from './GetSequenceFileAndDatabaseIdComponent';
import { clickMultiSelectOption } from '../../../cypress/e2e/common_functions';
import endpoints from './endpoints';

const SEQUENCE_NAME = 'ase1_CDS_PCR';
const textFilePattern = `**${endpoints.sequenceTextFile('*')}`;

function expectCloningStrategyFile(file, sequenceId, expectedSequenceFile) {
  expect(file.name).to.equal('cloning_strategy.json');
  return cy.readFileAsText(file).then((content) => {
    const parsed = JSON.parse(content);
    expect(parsed.sources).to.have.length(1);
    expect(parsed.sources[0].database_id).to.equal(sequenceId);
    expect(parsed.sources[0].type).to.equal('DatabaseSource');
    expect(parsed.sequences).to.have.length(1);
    expect(parsed.sequences[0]).to.include({
      ...expectedSequenceFile,
      id: 1,
    });
    expect(parsed.primers).to.eql([]);
  });
}

describe('<GetSequenceFileAndDatabaseIdComponent />', () => {
  it('selects a sequence and calls setFile and setDatabaseId with correct data', () => {
    const setFileSpy = cy.spy().as('setFileSpy');
    const setDatabaseIdSpy = cy.spy().as('setDatabaseIdSpy');
    cy.setupOpenCloningDBTestAuth();

    cy.interceptOpenCloningDBStub('get_sequences_search_by_name', { alias: 'getSequences' });
    cy.interceptOpenCloningDBStub('get_sequences_search_by_name_uid_query', { alias: 'getSequencesByNameUidQuery' });
    cy.interceptOpenCloningDBStub('get_text_file_sequence', { alias: 'getSequenceFile' });

    cy.mount(
      <GetSequenceFileAndDatabaseIdComponent setFile={setFileSpy} setDatabaseId={setDatabaseIdSpy} />,
    );

    cy.get('input').type(SEQUENCE_NAME);
    cy.get('.MuiAutocomplete-listbox li', { timeout: 10000 }).should('have.length.greaterThan', 0);
    cy.wait('@getSequences').its('request.url').should('include', `name=${SEQUENCE_NAME}`);

    clickMultiSelectOption('Sequence', RegExp(`^${SEQUENCE_NAME}$`), 'div');
    cy.getStub('get_text_file_sequence').then((stub) => {
      cy.get('@setDatabaseIdSpy').should('have.been.calledWith', stub.response.body.id);
      cy.get('@setFileSpy').should('have.been.calledOnce');
      return cy.get('@setFileSpy').then((spy) => {
        const [file] = spy.lastCall.args;
        return expectCloningStrategyFile(file, stub.response.body.id, stub.response.body.sequence);
      });
    });

  });

  it('shows a retry button when requesting the selected file fails and retries successfully', () => {
    const setFileSpy = cy.spy().as('setFileSpy');
    const setDatabaseIdSpy = cy.spy().as('setDatabaseIdSpy');

    cy.setupOpenCloningDBTestAuth();
    cy.interceptOpenCloningDBStub('get_sequences_search_by_name', { alias: 'getSequences' });
    cy.interceptOpenCloningDBStub('get_sequences_search_by_name_uid_query', { alias: 'getSequencesByNameUidQuery' });

    cy.getStub('get_text_file_sequence').then((textFileSequenceStub) => {
      let callCount = 0;
      cy.intercept('GET', textFilePattern, (req) => {
        callCount += 1;
        if (callCount === 1) {
          req.reply({ statusCode: 500 });
          return;
        }

        req.reply({
          statusCode: textFileSequenceStub.response.status_code,
          body: textFileSequenceStub.response.body,
          headers: textFileSequenceStub.response.headers,
        });
      }).as('getSequenceFile');
    });

    cy.mount(
      <GetSequenceFileAndDatabaseIdComponent setFile={setFileSpy} setDatabaseId={setDatabaseIdSpy} />,
    );

    cy.get('input').type(SEQUENCE_NAME);
    cy.get('.MuiAutocomplete-listbox li', { timeout: 10000 }).should('have.length.greaterThan', 0);
    cy.wait('@getSequences').its('request.url').should('include', `name=${SEQUENCE_NAME}`);

    clickMultiSelectOption('Sequence', RegExp(`^${SEQUENCE_NAME}$`), 'div');

    cy.wait('@getSequenceFile');
    cy.contains('Failed to load sequence file.').should('exist');
    cy.get('@setFileSpy').should('not.have.been.called');
    cy.get('@setDatabaseIdSpy').should('not.have.been.called');

    cy.contains('button', 'Retry').click();

    cy.wait('@getSequenceFile');
    cy.contains('Failed to load sequence file.').should('not.exist');
    cy.get('@setFileSpy').should('have.been.calledOnce');
    cy.get('@setDatabaseIdSpy').should('have.been.calledOnce');

  });
});

