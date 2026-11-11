import React from 'react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import SubmitToDatabaseComponent from './SubmitToDatabaseComponent';
import { mockPrimers, mockTeselaJsonCache } from '../../../tests/mockNetworkData';

const createTestStore = (cloningState) =>
  configureStore({
    reducer: {
      cloning: (state = cloningState) => state,
    },
    preloadedState: { cloning: cloningState },
  });

const defaultState = {
  primers: mockPrimers,
  teselaJsonCache: mockTeselaJsonCache,
};

describe('<SubmitToDatabaseComponent />', () => {
  it('displays the primer name in a disabled input and shows the alert', () => {
    // Primer id=7, name='Primer1'
    const store = createTestStore(defaultState);
    cy.mount(
      <Provider store={store}>
        <SubmitToDatabaseComponent
          id={7}
          setSubmissionData={cy.spy().as('setSubmissionDataSpy')}
          resourceType="primer"
        />
      </Provider>,
    );

    cy.get('input#resource_title').should('have.value', 'Primer1').and('be.disabled');
    cy.get('.MuiAlert-root').contains('To change the primer name').should('exist');
  });

  it('displays the sequence name in a disabled input and shows the alert', () => {
    // Sequence id=1, name='Seq1'
    const store = createTestStore(defaultState);
    cy.mount(
      <Provider store={store}>
        <SubmitToDatabaseComponent
          id={1}
          setSubmissionData={cy.spy().as('setSubmissionDataSpy')}
          resourceType="sequence"
        />
      </Provider>,
    );

    cy.get('input#resource_title').should('have.value', 'Seq1').and('be.disabled');
    cy.get('.MuiAlert-root').contains('To change the sequence name').should('exist');
  });
  it('sets the submission data to null when the name is missing (unlikely to happen in reality)', () => {
    const submissionDataNoName = structuredClone(defaultState);
    Object.values(submissionDataNoName.teselaJsonCache).forEach((value) => {
      value.name = '';
    });
    const store = createTestStore(submissionDataNoName);
    cy.mount(
      <Provider store={store}>
        <SubmitToDatabaseComponent
          id={1}
          setSubmissionData={cy.spy().as('setSubmissionDataSpy')}
          resourceType="sequence"
        />
      </Provider>,
    );
    cy.get('@setSubmissionDataSpy').should((spy) => {
      const result = spy.lastCall.args[0];
      expect(result).equal(null);
    });
  });
});
