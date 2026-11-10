import React from 'react';
import ELabFTWResourceSelect from './ELabFTWResourceSelect';
import { eLabFTWHttpClient } from './common';

describe('<ELabFTWResourceSelect />', () => {
  it('shows the right options when searching', () => {
    const setResourceSpy = cy.spy().as('setResourceSpy');
    cy.stub(eLabFTWHttpClient, 'get')
      .withArgs('/api/v2/items', {
        headers: { Authorization: 'test-read-key' },
        params: { cat: 1, extended: 'title:test', limit: 9999 },
      })
      .resolves({
        data: [
          { id: 1, title: 'Test Resource 1' },
          { id: 2, title: 'Test Resource 2' },
        ],
      });

    cy.mount(<ELabFTWResourceSelect fullWidth categoryId={1} setResource={setResourceSpy} />);

    // Type in the search field
    cy.get('.MuiAutocomplete-input').type('test');

    // Check if options are displayed
    cy.get('li').contains('Test Resource 1').should('exist');
    cy.get('li').contains('Test Resource 2').should('exist');

    // Select an option
    cy.get('li').contains('Test Resource 1').click();
    cy.get('@setResourceSpy').should('have.been.calledWith', { id: 1, title: 'Test Resource 1' });
  });

  it('shows empty options if no resources are found', () => {
    cy.stub(eLabFTWHttpClient, 'get')
      .withArgs('/api/v2/items', {
        headers: { Authorization: 'test-read-key' },
        params: { cat: 1, extended: 'title:nonexistent', limit: 9999 },
      })
      .resolves({
        data: [],
      });

    cy.mount(<ELabFTWResourceSelect fullWidth categoryId={1} />);
    cy.get('.MuiAutocomplete-input').type('nonexistent');
    cy.get('li').should('not.exist');
  });

  it('handles API errors gracefully', () => {
    let firstCall = true;
    cy.stub(eLabFTWHttpClient, 'get')
      .withArgs('/api/v2/items', {
        headers: { Authorization: 'test-read-key' },
        params: { cat: 1, extended: 'title:test', limit: 9999 },
      })
      .callsFake(() => {
        if (firstCall) {
          firstCall = false;
          return Promise.reject(new Error('API Error'));
        }
        return Promise.resolve({ data: [
          { id: 1, title: 'Test Resource 1' },
          { id: 2, title: 'Test Resource 2' },
        ] });
      });

    cy.mount(<ELabFTWResourceSelect fullWidth categoryId={1} />);
    cy.get('.MuiAutocomplete-input').type('test');
    // The component should handle the error gracefully
    cy.get('.MuiAlert-message').should('contain', 'Could not retrieve data');
    // Clicking the retry button makes the request again
    cy.get('button').contains('Retry').click();
    // Verify the second call was made
    cy.get('div.MuiInputBase-root').click();
    cy.get('li').contains('Test Resource 1').should('exist');
    cy.get('li').contains('Test Resource 2').should('exist');
  });

  it('updates search results when categoryId changes', () => {
    const getStub = cy.stub(eLabFTWHttpClient, 'get');

    // First category results
    getStub.withArgs('/api/v2/items', {
      headers: { Authorization: 'test-read-key' },
      params: { cat: 1, extended: 'title:test', limit: 9999 },
    }).resolves({
      data: [{ id: 1, title: 'Category 1 Resource' }],
    });

    // Second category results
    getStub.withArgs('/api/v2/items', {
      headers: { Authorization: 'test-read-key' },
      params: { cat: 2, extended: 'title:test', limit: 9999 },
    }).resolves({
      data: [{ id: 2, title: 'Category 2 Resource' }],
    });

    cy.mount(<ELabFTWResourceSelect fullWidth categoryId={1} />);
    cy.get('.MuiAutocomplete-input').type('test');
    cy.get('li').contains('Category 1 Resource').should('exist');

    // Change category and verify new results
    cy.mount(<ELabFTWResourceSelect fullWidth categoryId={2} />);
    cy.get('.MuiAutocomplete-input').type('test');
    cy.get('li').contains('Category 2 Resource').should('exist');
  });
});
