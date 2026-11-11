import React from 'react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import PrimersNotInDatabaseComponent from './PrimersNotInDatabaseComponent';
import { mockSequences, mockSources, mockPrimers } from '../../../tests/mockNetworkData';

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
  it('renders nothing when no primers are involved', () => {
    // id=4: source 4 has no inputs, so no primers in substate
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

    cy.get('.MuiAlert-root').should('not.exist');
  });

  it('shows primers that will be saved to the database', () => {
    // id=1: substate includes source 2 (OligoHybridization with primers 7 and 8).
    // Primer 7 (Primer1) has no database_id → shown.
    // Primer 8 (Primer2) already has database_id → hidden.
    // Source 3 has database_id so getSubState stops there (stopAtDatabaseId=true).
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

    cy.get('.MuiAlert-root').contains('The below primers will be saved to the database').should('exist');
    cy.get('.MuiAlert-root li').should('have.length', 1);
    cy.get('.MuiAlert-root li').contains('Primer1').should('exist');
  });
});
