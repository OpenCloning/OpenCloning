import React from 'react';
import ELabFTWCategorySelect from './ELabFTWCategorySelect';
import { eLabFTWHttpClient } from './common';

describe('<ELabFTWCategorySelect />', () => {
  it('Allows to retry if the request fails', () => {
    cy.stub(eLabFTWHttpClient, 'get').withArgs('/api/v2/info', { headers: { Authorization: 'test-read-key' } }).as('eLabFTWHttpClientSpy');
    cy.mount(<ELabFTWCategorySelect mode="resource_type" fullWidth />);
    cy.get('@eLabFTWHttpClientSpy.all').should('have.callCount', 1);
    cy.get('button').contains('Retry').click();
    cy.get('@eLabFTWHttpClientSpy.all').should('have.callCount', 2);
  });
  it('shows the right options', () => {
    const setCategorySpy = cy.spy().as('setCategorySpy');
    cy.stub(eLabFTWHttpClient, 'get')
      .withArgs('/api/v2/teams/current/resources_categories', { headers: { Authorization: 'test-read-key' }, params: {} }).resolves({
        data: [
          { id: 1, title: 'Category 1' },
          { id: 2, title: 'Category 2' },
        ],
      })
      .withArgs('/api/v2/info', { headers: { Authorization: 'test-read-key' } }).resolves({
        data: {
          elabftw_version_int: 50200,
        },
      });
    cy.mount(<ELabFTWCategorySelect mode="resource_type" fullWidth setCategory={setCategorySpy} />);
    cy.get('.MuiAutocomplete-root').click();
    cy.get('li').contains('Category 1').should('exist');
    cy.get('li').contains('Category 2').should('exist');
    cy.get('li').contains('Category 1').click();
    cy.get('@setCategorySpy').should('have.been.calledWith', { id: 1, title: 'Category 1' });
  });

  it('uses the items_types endpoint in template mode', () => {
    const setCategorySpy = cy.spy().as('setCategorySpy');
    cy.stub(eLabFTWHttpClient, 'get')
      .withArgs('/api/v2/items_types', { headers: { Authorization: 'test-read-key' }, params: {} }).resolves({
        data: [
          { id: 1, title: 'Template 1' },
          { id: 2, title: 'Template 2' },
        ],
      })
      .withArgs('/api/v2/info', { headers: { Authorization: 'test-read-key' } }).resolves({
        data: {
          elabftw_version_int: 50300,
        },
      });
    cy.mount(<ELabFTWCategorySelect mode="template" fullWidth setCategory={setCategorySpy} />);
    cy.get('.MuiAutocomplete-root').click();
    cy.get('li').contains('Template 1').should('exist');
    cy.get('li').contains('Template 2').should('exist');
    cy.get('li').contains('Template 1').click();
    cy.get('@setCategorySpy').should('have.been.calledWith', { id: 1, title: 'Template 1' });
  });

  it('shows empty options if no categories are found', () => {
    cy.mount(<ELabFTWCategorySelect mode="resource_type" fullWidth />);
    cy.stub(eLabFTWHttpClient, 'get')
      .withArgs('/api/v2/teams/current/resources_categories', { headers: { Authorization: 'test-read-key' }, params: {} }).resolves({
        data: [],
      })
      .withArgs('/api/v2/info', { headers: { Authorization: 'test-read-key' } }).resolves({
        data: {
          elabftw_version_int: 50200,
        },
      });
    cy.get('.MuiAutocomplete-root').click();
    cy.get('li').should('not.exist');
  });

  it('shows an error message if the request fails and can retry', () => {
    cy.mount(<ELabFTWCategorySelect mode="resource_type" fullWidth />);
    cy.stub(eLabFTWHttpClient, 'get')
      .withArgs('/api/v2/info', { headers: { Authorization: 'test-read-key' } })
      .resolves({
        data: {
          elabftw_version_int: 50300,
        },
      }).as('eLabFTWHttpClientSpyInfo')
      .withArgs('/api/v2/teams/current/resources_categories', { headers: { Authorization: 'test-read-key' }, params: {} })
      .rejects(new Error('Connection error')).as('eLabFTWHttpClientSpy');
    cy.get('.MuiAlert-message').should('contain', 'Could not retrieve categories');
    // Clicking the retry button makes the request again
    cy.get('button').contains('Retry').click();
    cy.get('@eLabFTWHttpClientSpy').should('have.callCount', 2);
    cy.get('@eLabFTWHttpClientSpyInfo').should('have.callCount', 1);
  });
});
