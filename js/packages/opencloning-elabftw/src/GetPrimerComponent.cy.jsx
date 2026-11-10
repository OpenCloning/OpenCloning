import React from 'react';
import GetPrimerComponent from './GetPrimerComponent';
import { eLabFTWHttpClient } from './common';

const PRIMER_CATEGORY_ID = 3;

describe('<GetPrimerComponent />', () => {
  it('shows category select and then resource select after category is chosen', () => {
    const setPrimerSpy = cy.spy().as('setPrimerSpy');
    const setErrorSpy = cy.spy().as('setErrorSpy');

    // Stub both endpoints in a single stub
    cy.stub(eLabFTWHttpClient, 'get').callsFake((url) => {
      if (url === '/api/v2/teams/current/resources_categories') {
        return Promise.resolve({
          data: [
            { id: PRIMER_CATEGORY_ID, title: 'Primers' },
            { id: 2, title: 'Other Category' },
          ],
        });
      }
      return Promise.resolve({ data: [] });
    });

    cy.mount(<GetPrimerComponent setPrimer={setPrimerSpy} setError={setErrorSpy} />);

    // Initially, only category select should be visible
    cy.get('.MuiAutocomplete-root').should('have.length', 1);

    // Select a category
    cy.get('.MuiAutocomplete-input').first().click();
    cy.get('.MuiAutocomplete-input').first().type('Primers');
    cy.get('li').contains('Primers').click();

    // Now resource select should appear
    cy.get('.MuiAutocomplete-root').should('have.length', 2);
  });

  it('successfully selects a primer with valid metadata', () => {
    const setPrimerSpy = cy.spy().as('setPrimerSpy');
    const setErrorSpy = cy.spy().as('setErrorSpy');

    // Stub both endpoints in a single stub
    cy.stub(eLabFTWHttpClient, 'get').callsFake((url, config) => {
      if (url === '/api/v2/teams/current/resources_categories') {
        return Promise.resolve({
          data: [{ id: PRIMER_CATEGORY_ID, title: 'Primers' }],
        });
      }
      if (url === '/api/v2/items' && config?.params?.cat === PRIMER_CATEGORY_ID) {
        return Promise.resolve({
          data: [{
            id: 1,
            title: 'Test Primer',
            metadata: JSON.stringify({
              extra_fields: {
                sequence: { value: 'ATCG' },
              },
            }),
          }],
        });
      }
      return Promise.resolve({ data: [] });
    });

    cy.mount(<GetPrimerComponent setPrimer={setPrimerSpy} setError={setErrorSpy} />);

    // Select category
    cy.get('.MuiAutocomplete-input').first().click();
    cy.get('.MuiAutocomplete-input').first().type('Primers');
    cy.get('li').contains('Primers').click();

    // Select primer
    cy.get('.MuiAutocomplete-input').last().type('test');
    cy.get('li').contains('Test Primer').click();

    // Check if setPrimer was called with correct data
    cy.get('@setPrimerSpy').should('have.been.calledWith', {
      name: 'Test Primer',
      sequence: 'ATCG',
      database_id: 1,
    });
    cy.get('@setErrorSpy').should('not.have.been.called');
  });

  it('handles primer with invalid metadata', () => {
    const setPrimerSpy = cy.spy().as('setPrimerSpy');
    const setErrorSpy = cy.spy().as('setErrorSpy');

    // Stub both endpoints in a single stub
    cy.stub(eLabFTWHttpClient, 'get').callsFake((url, config) => {
      if (url === '/api/v2/teams/current/resources_categories') {
        return Promise.resolve({
          data: [{ id: PRIMER_CATEGORY_ID, title: 'Primers' }],
        });
      }
      if (url === '/api/v2/items' && config?.params?.cat === PRIMER_CATEGORY_ID) {
        return Promise.resolve({
          data: [{
            id: 1,
            title: 'Invalid Primer',
            metadata: JSON.stringify({
              extra_fields: {
                // Missing sequence field
              },
            }),
          }],
        });
      }
      if (url === '/api/v2/info') {
        return Promise.resolve({
          data: {
            elabftw_version_int: 50200,
          },
        });
      }
    });

    cy.mount(<GetPrimerComponent setPrimer={setPrimerSpy} setError={setErrorSpy} />);

    // Select category
    cy.get('.MuiAutocomplete-input').first().click();
    cy.get('.MuiAutocomplete-input').first().type('Primers');
    cy.get('li').contains('Primers').click();

    // Select primer
    cy.get('.MuiAutocomplete-input').last().type('test');
    cy.get('li').contains('Invalid Primer').click();

    // Check if error was set and primer was cleared
    cy.get('@setErrorSpy').should('have.been.calledWith', 'No sequence found in metadata');
    cy.get('@setPrimerSpy').should('have.been.calledWith', null);
  });

  it('clears primer when category is cleared', () => {
    const setPrimerSpy = cy.spy().as('setPrimerSpy');
    const setErrorSpy = cy.spy().as('setErrorSpy');

    cy.stub(eLabFTWHttpClient, 'get').callsFake((url) => {
      if (url === '/api/v2/teams/current/resources_categories') {
        return Promise.resolve({
          data: [{ id: PRIMER_CATEGORY_ID, title: 'Primers' }],
        });
      }
      if (url === '/api/v2/info') {
        return Promise.resolve({
          data: {
            elabftw_version_int: 50200,
          },
        });
      }
    });

    cy.mount(<GetPrimerComponent setPrimer={setPrimerSpy} setError={setErrorSpy} />);

    // Select category
    cy.get('.MuiAutocomplete-input').first().click();
    cy.get('.MuiAutocomplete-input').first().type('Primers');
    cy.get('li').contains('Primers').click();

    // Clear category
    cy.get('.MuiAutocomplete-clearIndicator').first().click();

    // Check if primer was cleared
    cy.get('@setPrimerSpy').should('have.been.calledWith', null);
    cy.get('.MuiAutocomplete-root').should('have.length', 1);
  });

  it('clears error when resource is cleared', () => {
    const setPrimerSpy = cy.spy().as('setPrimerSpy');
    const setErrorSpy = cy.spy().as('setErrorSpy');

    // Stub both endpoints in a single stub
    cy.stub(eLabFTWHttpClient, 'get').callsFake((url, config) => {
      if (url === '/api/v2/teams/current/resources_categories') {
        return Promise.resolve({
          data: [{ id: PRIMER_CATEGORY_ID, title: 'Primers' }],
        });
      }
      if (url === '/api/v2/items' && config?.params?.cat === PRIMER_CATEGORY_ID) {
        return Promise.resolve({
          data: [{
            id: 1,
            title: 'Invalid Primer',
            metadata: '{invalid json}',
          }],
        });
      }
      if (url === '/api/v2/info') {
        return Promise.resolve({
          data: {
            elabftw_version_int: 50200,
          },
        });
      }
    });

    cy.mount(<GetPrimerComponent setPrimer={setPrimerSpy} setError={setErrorSpy} />);

    // Select category
    cy.get('.MuiAutocomplete-input').first().click();
    cy.get('.MuiAutocomplete-input').first().type('Primers');
    cy.get('li').contains('Primers').click();

    // Select and then clear resource
    cy.get('.MuiAutocomplete-input').last().type('test');
    cy.get('li').contains('Invalid Primer').click();
    cy.get('.MuiAutocomplete-clearIndicator').last().click();

    // Check if error was cleared
    cy.get('@setErrorSpy').should('have.been.calledWith', '');
    cy.get('@setPrimerSpy').should('have.been.calledWith', null);
  });
  it('handles network errors', () => {
    const setPrimerSpy = cy.spy().as('setPrimerSpy');
    const setErrorSpy = cy.spy().as('setErrorSpy');

    let firstCallCategory = true;
    let firstCallPrimer = true;
    cy.stub(eLabFTWHttpClient, 'get').callsFake((url, config) => {
      if (url === '/api/v2/teams/current/resources_categories') {
        if (firstCallCategory) {
          firstCallCategory = false;
          return Promise.reject(new Error('Network error'));
        }
        return Promise.resolve({
          data: [{ id: PRIMER_CATEGORY_ID, title: 'Primers' }],
        });
      }
      if (url === '/api/v2/items' && config?.params?.cat === PRIMER_CATEGORY_ID) {
        if (firstCallPrimer) {
          firstCallPrimer = false;
          return Promise.reject(new Error('Network error'));
        }
        return Promise.resolve({
          data: [{ id: 1, title: 'Test Primer' }],
        });
      }
      if (url === '/api/v2/info') {
        return Promise.resolve({
          data: {
            elabftw_version_int: 50200,
          },
        });
      }
    });

    cy.mount(<GetPrimerComponent setPrimer={setPrimerSpy} setError={setErrorSpy} />);

    cy.get('.MuiAlert-message').should('contain', 'Could not retrieve categories');
    cy.get('button').contains('Retry').click();
    cy.get('.MuiAutocomplete-input').first().click();
    cy.get('.MuiAutocomplete-input').first().type('Primers');
    cy.get('li').contains('Primers').click();
    cy.get('.MuiAutocomplete-input').last().type('test');
    cy.get('.MuiAlert-message').should('contain', 'Could not retrieve');
    cy.get('button').contains('Retry').click();
    cy.get('.MuiAutocomplete-root').eq(1).click();
    cy.get('li').contains('Test Primer').click();
  });
});
