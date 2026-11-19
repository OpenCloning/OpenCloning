import React from 'react';
import store from '@opencloning/store';
import { cloningActions } from '@opencloning/store/cloning';
import { ConfigProvider } from '../providers/ConfigProvider';
import { DatabaseProvider } from '../providers/DatabaseContext';
import useLoadDatabaseFile from './useLoadDatabaseFile';

const config = { backendUrl: 'http://localhost:8000' };
const appInfo = { backendVersion: '9.9.9', schemaVersion: '0.9.0', frontendVersion: '8.8.8' };
const DATABASE_ID = 42;

// Calls loadDatabaseFile when the button is clicked, without a source component (like useUrlParamsLoader)
function LoadButton({ file, onError }) {
  const { loadDatabaseFile } = useLoadDatabaseFile({ source: { id: 1 }, sendSourceRequest: null, setHistoryFileError: onError });
  return <button type="button" onClick={() => loadDatabaseFile(file, DATABASE_ID)}>Load</button>;
}

function mountLoadButton(file, database) {
  const onError = cy.spy().as('onError');
  cy.mount(
    <ConfigProvider config={config}>
      <DatabaseProvider value={database}>
        <LoadButton file={file} onError={onError} />
      </DatabaseProvider>
    </ConfigProvider>,
  );
  cy.get('button').click();
}

const fakeDatabase = () => ({
  getPrimer: cy.stub().rejects(new Error('no primers in this test')),
  getSequenceName: cy.stub().resolves(null),
});

describe('useLoadDatabaseFile', () => {
  let genbank;
  before(() => {
    cy.readFile('cypress/test_files/dummy_sequencing.gb').then((content) => { genbank = content; });
  });

  beforeEach(() => {
    store.dispatch(cloningActions.reset());
    store.dispatch(cloningActions.updateAppInfo(appInfo));
  });

  const historyFile = (versions = {}) => {
    const cloningStrategy = {
      sources: [{ id: 1, type: 'ManuallyTypedSource', input: [], user_input: 'ACGT' }],
      sequences: [{ id: 1, type: 'TextFileSequence', sequence_file_format: 'genbank', file_content: genbank }],
      primers: [],
      ...versions,
    };
    return new File([JSON.stringify(cloningStrategy)], 'cloning_strategy.json', { type: 'application/json' });
  };

  const interceptValidate = () => {
    cy.intercept('POST', '**/validate', {
      statusCode: 200, body: 'null', headers: { 'content-type': 'application/json' },
    }).as('validate');
  };

  it('keeps the versions of a history file, so that old ones are migrated', () => {
    interceptValidate();
    const versions = { backend_version: '0.1.0', schema_version: '0.2.9', frontend_version: '0.1.0' };
    mountLoadButton(historyFile(versions), fakeDatabase());
    cy.wait('@validate').its('request.body').should('include', versions);
    cy.wrap(store).should((s) => {
      const { sources } = s.getState().cloning;
      expect(sources.map((src) => src.database_id)).to.include(DATABASE_ID);
    });
    cy.get('@onError').should('not.have.been.called');
  });

  it('sets the app versions on a history file that has none', () => {
    interceptValidate();
    mountLoadButton(historyFile(), fakeDatabase());
    cy.wait('@validate').its('request.body').should('include', {
      backend_version: appInfo.backendVersion,
      schema_version: appInfo.schemaVersion,
      frontend_version: appInfo.frontendVersion,
    });
  });

  it('reads a sequence file without a source component, and sets its database id', () => {
    cy.intercept('POST', '**/read_from_file', {
      statusCode: 200,
      body: {
        sources: [{ id: 0, type: 'UploadedFileSource', input: [], file_name: 'seq.gb', sequence_file_format: 'genbank' }],
        sequences: [{ id: 0, type: 'TextFileSequence', sequence_file_format: 'genbank', file_content: genbank }],
      },
    }).as('readFromFile');
    cy.then(() => mountLoadButton(new File([genbank], 'seq.gb'), fakeDatabase()));
    cy.wait('@readFromFile');
    cy.wrap(store).should((s) => {
      const { sources, sequences } = s.getState().cloning;
      // The empty placeholder source is replaced by the sequence
      expect(sources).to.have.length(1);
      expect(sources[0]).to.include({ type: 'UploadedFileSource', database_id: DATABASE_ID });
      expect(sequences).to.have.length(1);
      expect(sequences[0].id).to.equal(sources[0].id);
    });
    cy.get('@onError').should('not.have.been.called');
  });

  it('reports the error if the sequence file cannot be read', () => {
    cy.intercept('POST', '**/read_from_file', { statusCode: 422, body: { detail: 'Bad file' } }).as('readFromFile');
    cy.then(() => mountLoadButton(new File(['not a sequence'], 'seq.gb'), fakeDatabase()));
    cy.wait('@readFromFile');
    cy.get('@onError').should('have.been.calledWith', 'Could not read the file seq.gb: Bad file');
  });
});
