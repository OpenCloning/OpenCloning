import React from 'react';
import GetSequenceFileAndDatabaseIdComponent from './GetSequenceFileAndDatabaseIdComponent';
import { eLabFTWHttpClient } from './common';
import { clearAutocompleteValue, clickMultiSelectOption, setAutocompleteValue } from '../../../cypress/e2e/common_functions';

let uniqueId = 1;
const newUniqueId = () => uniqueId++;
const SEQUENCE_CATEGORY_ID = newUniqueId();
const OTHER_CATEGORY_ID = newUniqueId();
const SEQUENCE_RESOURCE_ID = newUniqueId();
const OTHER_RESOURCE_ID = newUniqueId();
const SEQUENCE_FILE_ID = newUniqueId();
const OTHER_FILE_ID = newUniqueId();
const TEST_FILE_CONTENT = 'test content';

const commonStubHandler = (url, config) => {
  if (url === '/api/v2/teams/current/resources_categories') {
    return Promise.resolve({
      data: [
        { id: SEQUENCE_CATEGORY_ID, title: 'Sequences' },
        { id: OTHER_CATEGORY_ID, title: 'Other Category' },
      ],
    });
  }
  if (url === '/api/v2/items' && config?.params?.cat === 1) {
    return Promise.resolve({
      data: [{
        id: SEQUENCE_RESOURCE_ID,
        title: 'Test Sequence',
      },
      {
        id: OTHER_RESOURCE_ID,
        title: 'Other Resource',
      },
      ],
    });
  }
  if (url === `/api/v2/items/${SEQUENCE_RESOURCE_ID}`) {
    return Promise.resolve({
      data: {
        uploads: [
          { id: SEQUENCE_FILE_ID, real_name: 'sequence.gb' },
          { id: OTHER_FILE_ID, real_name: 'other.txt' },
        ],
      },
    });
  }
  if (url === '/api/v2/info') {
    return Promise.resolve({
      data: {
        elabftw_version_int: 50200,
      },
    });
  }
  return null;
};

describe('<GetSequenceFileAndDatabaseIdComponent />', () => {
  it('normal case', () => {
    const setFileSpy = cy.spy().as('setFileSpy');
    const setDatabaseIdSpy = cy.spy().as('setDatabaseIdSpy');

    // Stub API calls
    cy.stub(eLabFTWHttpClient, 'get').callsFake((url, config) => {
      const commonResponse = commonStubHandler(url, config);
      if (commonResponse !== null) {
        return commonResponse;
      }
      if (url === `/api/v2/items/${SEQUENCE_RESOURCE_ID}/uploads/${SEQUENCE_FILE_ID}?format=binary`) {
        return Promise.resolve({ data: new Blob([TEST_FILE_CONTENT], { type: 'application/octet-stream' }) });
      }
      return Promise.resolve({ data: [] });
    });

    cy.mount(<GetSequenceFileAndDatabaseIdComponent setFile={setFileSpy} setDatabaseId={setDatabaseIdSpy} />);

    // Initially, only category select should be visible
    cy.get('.MuiAutocomplete-root').should('have.length', 1);

    // Select a category
    cy.get('.MuiAutocomplete-input').first().click();
    cy.get('.MuiAutocomplete-input').first().type('Sequences');
    cy.get('li').contains('Sequences').click();

    // Resource select should appear
    cy.get('.MuiAutocomplete-root').should('have.length', 2);

    // Select a resource
    cy.get('.MuiAutocomplete-input').last().type('Test');
    cy.get('li').contains('Test Sequence').click();

    // File select should appear
    clickMultiSelectOption('File with sequence', 'sequence.gb', 'div');
    // We must compare like this, because using have.been.calledWith does not compare files
    cy.get('@setFileSpy').should((spy) => {
      const calledFile = spy.lastCall.args[0]; // Get the first argument of the first call
      expect(calledFile).to.be.instanceOf(File);
      expect(calledFile.name).to.equal('sequence.gb');
      // Read the file content and compare
      const reader = new FileReader();
      reader.onload = (e) => {
        const actualContent = e.target.result;
        expect(actualContent).to.equal(TEST_FILE_CONTENT);
      };
      reader.readAsText(calledFile);
    });
    cy.get('@setDatabaseIdSpy').should('have.been.calledWith', SEQUENCE_RESOURCE_ID);
  });

  it('handles error when getting file', () => {
    const setFileSpy = cy.spy().as('setFileSpy');
    const setDatabaseIdSpy = cy.spy().as('setDatabaseIdSpy');

    let firstCall = true;
    cy.stub(eLabFTWHttpClient, 'get').callsFake((url, config) => {
      const commonResponse = commonStubHandler(url, config);
      if (commonResponse !== null) {
        return commonResponse;
      }
      if (url === `/api/v2/items/${SEQUENCE_RESOURCE_ID}/uploads/${SEQUENCE_FILE_ID}?format=binary`) {
        if (firstCall) {
          firstCall = false;
          return Promise.reject(new Error('File not found'));
        }
        return Promise.resolve({ data: new Blob([TEST_FILE_CONTENT], { type: 'application/octet-stream' }) });
      }
      return Promise.resolve({ data: [] });
    });

    cy.mount(<GetSequenceFileAndDatabaseIdComponent setFile={setFileSpy} setDatabaseId={setDatabaseIdSpy} />);

    // Select a category
    clickMultiSelectOption('Resource category', 'Sequences', 'div');
    setAutocompleteValue('Resource', 'Test Sequence', '.elabftw-resource-select');
    clickMultiSelectOption('File with sequence', 'sequence.gb', 'div');
    cy.get('.MuiAlert-message').should('contain', 'Error loading file');
    cy.get('button').contains('Retry').click();
    cy.get('.MuiAlert-message').should('not.exist');
    cy.get('@setFileSpy').should((spy) => {
      const calledFile = spy.lastCall.args[0]; // Get the first argument of the first call
      expect(calledFile).to.be.instanceOf(File);
      expect(calledFile.name).to.equal('sequence.gb');
      // Read the file content and compare
      const reader = new FileReader();
      reader.onload = (e) => {
        const actualContent = e.target.result;
        expect(actualContent).to.equal(TEST_FILE_CONTENT);
      };
      reader.readAsText(calledFile);
    });
    cy.get('@setDatabaseIdSpy').should('have.been.calledWith', SEQUENCE_RESOURCE_ID);
  });

  it('unsets subsequent fields when an upper one changes', () => {
    cy.stub(eLabFTWHttpClient, 'get').callsFake(commonStubHandler);
    cy.mount(<GetSequenceFileAndDatabaseIdComponent setFile={cy.spy()} setDatabaseId={cy.spy()} />);
    clickMultiSelectOption('Resource category', 'Sequences', 'div');
    setAutocompleteValue('Resource', 'Test Sequence', '.elabftw-resource-select');
    clickMultiSelectOption('File with sequence', 'sequence.gb', 'div');

    // Unset category should clear the rest
    clearAutocompleteValue('Resource category', 'div.elabftw-category-select');
    cy.get('.elabftw-resource-select').should('not.exist');
    cy.get('.elabftw-file-select').should('not.exist');
    cy.get('.elabftw-category-select').click();

    clickMultiSelectOption('Resource category', 'Sequences', 'div');

    // Resource value should be unset
    cy.get('.elabftw-resource-select input').should('have.value', '');
    setAutocompleteValue('Resource', 'Test Sequence', '.elabftw-resource-select');

    // File value should be unset
    cy.get('.elabftw-file-select input').should('have.value', '');
    clickMultiSelectOption('File with sequence', 'sequence.gb', 'div');

    // Unset resource should clear file
    clearAutocompleteValue('Resource', '.elabftw-resource-select');
    cy.get('.elabftw-file-select').should('not.exist');
    cy.get('.elabftw-resource-select').click();
    setAutocompleteValue('Resource', 'Test Sequence', '.elabftw-resource-select');
    cy.get('.elabftw-file-select input').should('have.value', '');
  });
});
