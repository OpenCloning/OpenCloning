import React from 'react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import PrimersNotInDatabaseComponent from './PrimersNotInDatabaseComponent';
import { eLabFTWHttpClient } from './common';
import { mockSequences, mockSources, mockPrimers } from '../../../tests/mockNetworkData';

const PRIMER_CATEGORY_ID = 3;

const defaultState = {
  sequences: mockSequences,
  sources: mockSources,
  primers: mockPrimers,
};

const createTestStore = (cloningState) => configureStore({
  reducer: {
    cloning: (state = cloningState) => state,
  },
  preloadedState: { cloning: cloningState },
});

describe('<PrimersNotInDatabaseComponent />', () => {
  it('renders nothing when no primers need saving', () => {
    cy.stub(eLabFTWHttpClient, 'get')
      .withArgs('/api/v2/items_types')
      .resolves({
        data: [
          { id: PRIMER_CATEGORY_ID, title: 'Primers' },
          { id: 2, title: 'Other' },
        ],
      });
    const store = createTestStore(defaultState);
    cy.mount(
      <Provider store={store}>
        <PrimersNotInDatabaseComponent
          id={4}
          submissionData={{}}
          setSubmissionData={cy.spy().as('setSubmissionDataSpy')}
        />
      </Provider>,
    );

    // Component should not render anything
    cy.get('.MuiAlert-root').should('not.exist');
  });

  it('shows primers that need saving', () => {
    cy.stub(eLabFTWHttpClient, 'get')
      .withArgs('/api/v2/items_types')
      .resolves({
        data: [
          { id: PRIMER_CATEGORY_ID, title: 'Primers' },
          { id: 2, title: 'Other' },
        ],
      }).withArgs('/api/v2/info').resolves({
        data: {
          elabftw_version_int: 50200,
        },
      });
    // In this case, it should show only 1, because substate goes only up to
    // the sequence with database_id, and one of the primers already has a database_id
    const store = createTestStore(defaultState);

    cy.mount(
      <Provider store={store}>
        <PrimersNotInDatabaseComponent
          id={1}
          submissionData={{}}
          setSubmissionData={cy.spy().as('setSubmissionDataSpy')}
        />
      </Provider>,
    );

    // Component should not render anything
    cy.get('.MuiAlert-root').contains('Do you want used primers to be saved to the database?').should('exist');
    cy.get('.MuiAlert-root li').should('have.length', 1);
    cy.get('.MuiAlert-root li').contains('Primer1').should('exist');

    // Shows the categories to choose from
    cy.get('input').click();
    cy.get('li').contains('Other').should('exist');
    cy.get('li').contains('Primers').click();

    // Should update submission data
    cy.get('@setSubmissionDataSpy').should((spy) => {
      const updateFn = spy.lastCall.args[0];
      const result = updateFn({ hello: 'world' });
      expect(result).to.deep.equal({ primerCategoryId: PRIMER_CATEGORY_ID, hello: 'world' });
    });

    // Mount with new data (simulating a successful update)
    cy.mount(
      <Provider store={store}>
        <PrimersNotInDatabaseComponent
          id={1}
          submissionData={{ primerCategoryId: PRIMER_CATEGORY_ID }}
        />
      </Provider>,
    );

    // Should show success state
    cy.get('.MuiAlert-colorSuccess').should('exist');
    cy.contains('Do you want used primers to be saved to the database?').should('not.exist');
  });

  it('shows error when update fails', () => {
    let firstCall = true;
    cy.stub(eLabFTWHttpClient, 'get')
      .withArgs('/api/v2/items_types', { headers: { Authorization: 'test-read-key' }, params: {} })
      .callsFake((url, config) => {
        if (url !== '/api/v2/items_types' || config.headers?.Authorization !== 'test-read-key') {
          throw new Error('Unexpected call to get method with these parameters');
        }
        if (firstCall) {
          firstCall = false;
          const err = new Error('Failed to fetch items types');
          err.response = {
            status: 500,
          };
          return Promise.reject(err);
        }
        return Promise.resolve({
          data: [
            { id: PRIMER_CATEGORY_ID, title: 'Primers' },
            { id: 2, title: 'Other' },
          ],
        });
      }).withArgs('/api/v2/info').resolves({
        data: {
          elabftw_version_int: 50200,
        }
      });
    // Mount with new data (simulating a failed update)
    const store = createTestStore(defaultState);
    cy.mount(
      <Provider store={store}>
        <PrimersNotInDatabaseComponent
          id={1}
          submissionData={{}}
          setSubmissionData={cy.spy().as('setSubmissionDataSpy')}
        />
      </Provider>,
    );

    // Should show error state
    cy.get('.MuiAlert-colorError').should('exist');
    cy.contains('Could not retrieve categories from eLab').should('exist');
    cy.contains('Retry').click();
    // Should be normal again
    cy.get('input').click();
    cy.get('li').contains('Other').click();
    cy.get('@setSubmissionDataSpy').should((spy) => {
      const updateFn = spy.lastCall.args[0];
      const result = updateFn({ hello: 'world' });
      expect(result).to.deep.equal({ primerCategoryId: 2, hello: 'world' });
    });
  });
});
