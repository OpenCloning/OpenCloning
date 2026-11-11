import React from 'react';
import VerificationFileDialog from './VerificationFileDialog';
import store from '@opencloning/store';
import { cloningActions } from '@opencloning/store/cloning';
import { loadDataAndMount } from '../../../../../cypress/e2e/common_funcions_store';
import { getVerificationFileName } from '@opencloning/utils/readNwrite';
import {
  clearVerificationFileContents,
  getVerificationFileContent,
  setVerificationFileContent,
} from '@opencloning/utils/verificationFileStore';
import { ConfigProvider } from '@opencloning/ui/providers/ConfigProvider';
import { Provider } from 'react-redux';

const { setFiles } = cloningActions;

const config = {
  backendUrl: 'http://127.0.0.1:8000',
};

const dummyFiles = [
  { file_name: 'file1.txt', sequence_id: 1, file_type: 'Sequencing file' },
  { file_name: 'file2.txt', sequence_id: 1, file_type: 'Sequencing file' },
  { file_name: 'file1.txt', sequence_id: 2, file_type: 'Sequencing file' },
];
// This is the base64 encoded string for the text "hello"
const base64str = 'aGVsbG8=';

describe('<VerificationFileDialog />', () => {
  beforeEach(() => {
    clearVerificationFileContents();
  });
  it('renders and calls setDialogOpen with false when clicking close button', () => {
    // see: https://on.cypress.io/mounting-react
    const setDialogOpenSpy = cy.spy().as('setDialogOpenSpy');
    cy.mount(
      <Provider store={store}>
        <ConfigProvider config={config}>
          <VerificationFileDialog id={1} dialogOpen setDialogOpen={setDialogOpenSpy} />
        </ConfigProvider>
      </Provider>
    );

    // Click close button
    cy.get('button').contains('Close').click();
    cy.get('@setDialogOpenSpy').should('have.been.calledWith', false);

    // Reset spy
    setDialogOpenSpy.resetHistory();

    // Click outside dialog
    cy.get('.MuiDialog-container').click(0, 0);
    cy.get('@setDialogOpenSpy').should('have.been.calledWith', false);
  });

  it('displays existing files and can download and delete them', () => {
    store.dispatch(setFiles(dummyFiles));
    dummyFiles.forEach((file) => {
      setVerificationFileContent(getVerificationFileName(file), base64str);
    });
    cy.mount(
      <Provider store={store}>
        <ConfigProvider config={config}>
          <VerificationFileDialog id={1} dialogOpen setDialogOpen={() => {}} />
        </ConfigProvider>
      </Provider>
    );
    // Even though there are two files with the same name, only one should be displayed
    cy.get('table td').filter(':contains("file1.txt")').should('have.length', 1);
    cy.get('table').contains('file2.txt');
    cy.get('table td').filter(':contains("Sequencing file")').should('have.length', 2);
    cy.get('[data-testid="DownloadIcon"]').first().click();
    cy.readFile('cypress/downloads/file1.txt').should('eq', 'hello');

    cy.get('[data-testid="DeleteIcon"]').first().click();
    cy.get('table').contains('file2.txt');
    cy.get('table').contains('file1.txt').should('not.exist').then(() => {
      // Check that the file is not in the verification file store
      expect(getVerificationFileContent('verification-1-file1.txt')).to.be.null;
      expect(getVerificationFileContent('verification-1-file2.txt')).to.not.be.null;
    });
  });

  it('can submit files and aligns them', () => {
    loadDataAndMount(
      'cypress/test_files/sequencing/cloning_strategy_linear.json',
      store,
      () => {
        cy.mount(
          <Provider store={store}>
            <ConfigProvider config={config}>
              <VerificationFileDialog id={2} dialogOpen setDialogOpen={() => {}} />
            </ConfigProvider>
          </Provider>
        );
      },
    ).then(() => {
      cy.get('button').contains('Submit files').click();
      cy.get('input[type="file"]').selectFile('cypress/test_files/sequencing/BZO902-13409020-13409020.ab1', { force: true });
      cy.get('table').contains('BZO902-13409020-13409020.ab1', { timeout: 20000 });
    }).then(() => {
      const file = store.getState().cloning.files.find(
        (f) => f.file_name === 'BZO902-13409020-13409020.ab1',
      );
      cy.expect(file.file_type).to.equal('Sequencing file');
      cy.expect(file.sequence_id).to.equal(2);
      cy.expect(file.alignment).to.have.length(2);
      // The file content is stored in the verification file store
      cy.wrap(getVerificationFileContent(getVerificationFileName(file)))
        .should('not.be.null', { timeout: 10000 });

      cy.intercept('POST', 'http://127.0.0.1:8000/align_sanger*', {
        statusCode: 200,
        body: ['A', 'T', 'C'],
      }).as('alignSanger');
      // We upload another file now
      cy.get('button').contains('Submit files').click();
      cy.get('input[type="file"]').selectFile('cypress/test_files/sequencing/BZO903-13409037-13409037.ab1', { force: true });

      cy.get('table').contains('BZO903-13409037-13409037.ab1', { timeout: 20000 });
      cy.wait('@alignSanger').then((interception) => {
        // Submits both the old and new sequences for alignment
        expect(interception.request.body.traces).to.have.length(2);
      });
    })
      .then(() => {
      // The file has been added to the store
        const file = store.getState().cloning.files.find(
          (f) => f.file_name === 'BZO903-13409037-13409037.ab1',
        );
        cy.expect(file).to.exist;
        cy.expect(file.file_type).to.equal('Sequencing file');
        cy.expect(file.sequence_id).to.equal(2);
        cy.expect(file.alignment).to.deep.equal(['A', 'C']);
        // The file content is stored in the verification file store
        cy.wrap(getVerificationFileContent(getVerificationFileName(file)))
          .should('not.be.null', { timeout: 10000 });
      });
  });
  it('handles errors', () => {
    loadDataAndMount(
      'cypress/test_files/sequencing/cloning_strategy_linear.json',
      store,
      () => {
        cy.mount(
          <Provider store={store}>
            <ConfigProvider config={config}>
              <VerificationFileDialog id={2} dialogOpen setDialogOpen={() => {}} />
            </ConfigProvider>
          </Provider>
        );
      },
    ).then(() => {
      // Error if submitting non-allowed files
      cy.get('button').contains('Submit files').click();
      cy.get('input[type="file"]').selectFile('cypress/test_files/sequencing/cloning_strategy_linear.json', { force: true });
      cy.contains('Only ab1');

      // Error if submitting .ab1 files that are not valid
      cy.get('button').contains('Submit files').click();
      cy.get('input[type="file"]').selectFile('cypress/test_files/sequencing/wrong.ab1', { force: true });
      cy.contains('Error parsing wrong.ab1:', { timeout: 20000 });

      cy.intercept('POST', 'http://127.0.0.1:8000/align_sanger*', {
        statusCode: 200,
        body: ['A', 'T'],
      });
      // Error if name already exists
      // Add it once
      cy.get('button').contains('Submit files').click();
      cy.get('input[type="file"]').selectFile('cypress/test_files/sequencing/BZO903-13409037-13409037.ab1', { force: true });
      cy.get('table').contains('BZO903-13409037-13409037.ab1', { timeout: 20000 });

      // Add it again
      cy.get('button').contains('Submit files').click();
      cy.get('input[type="file"]').selectFile('cypress/test_files/sequencing/BZO903-13409037-13409037.ab1', { force: true });
      cy.contains('A file named BZO903-13409037-13409037.ab1 is already associated to this sequence');

      // Error if the server returns an error
      cy.intercept('POST', 'http://127.0.0.1:8000/align_sanger*', {
        statusCode: 500,
      });
      cy.get('button').contains('Submit files').click();
      cy.get('input[type="file"]').selectFile('cypress/test_files/sequencing/BZO902-13409020-13409020.ab1', { force: true });
      cy.contains('Request failed');
      // It has not been added
      cy.get('table').contains('BZO902-13409020-13409020.ab1').should('not.exist');
      expect(getVerificationFileContent('verification-2-BZO902-13409020-13409020.ab1')).to.be.null;

      // Connection error
      cy.intercept('POST', 'http://127.0.0.1:8000/align_sanger*', {
        forceNetworkError: true,
      });
      cy.get('button').contains('Submit files').click();
      cy.get('input[type="file"]').selectFile('cypress/test_files/sequencing/BZO902-13409020-13409020.ab1', { force: true });
      cy.contains('Network Error');
    });
  });
});
