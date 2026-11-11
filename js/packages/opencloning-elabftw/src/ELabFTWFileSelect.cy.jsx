import React from 'react';
import ELabFTWFileSelect from './ELabFTWFileSelect';
import { eLabFTWHttpClient } from './common';

describe('<ELabFTWFileSelect />', () => {
  it('shows the right options', () => {
    const setFileInfoSpy = cy.spy().as('setFileInfoSpy');
    // Stub the eLabFTWHttpClient similar to the pattern in eLabFTWInterface.test.js
    cy.stub(eLabFTWHttpClient, 'get').withArgs('/api/v2/items/1', { headers: { Authorization: 'test-read-key' }, params: {}  }).resolves({
      data: {
        uploads: [
          { id: 1, real_name: 'file1.txt' },
          { id: 2, real_name: 'file2.txt' },
        ],
      },
    });
    cy.mount(<ELabFTWFileSelect fullWidth itemId={1} setFileInfo={setFileInfoSpy} />);
    cy.get('div.MuiSelect-select').click();
    cy.get('li').contains('file1.txt').should('exist');
    cy.get('li').contains('file2.txt').should('exist');
    cy.get('li').contains('file1.txt').click();
    cy.get('@setFileInfoSpy').should('have.been.calledWith', { id: 1, real_name: 'file1.txt' });
  });
  it('shows empty options if no files are found', () => {
    cy.mount(<ELabFTWFileSelect fullWidth itemId={1} />);
    cy.stub(eLabFTWHttpClient, 'get').withArgs('/api/v2/items/1', { headers: { Authorization: 'test-read-key' }, params: {} }).resolves({
      data: {
        uploads: [],
      },
    });
    cy.get('div.MuiSelect-select').click();
    cy.get('li').should('not.exist');
  });

  it('shows an error message if the request fails and can retry', () => {
    cy.mount(<ELabFTWFileSelect fullWidth itemId={1} />);
    cy.get('.MuiAlert-message').should('contain', 'Could not retrieve attachment');
    // Clicking the retry button makes the request again
    cy.spy(eLabFTWHttpClient, 'get').as('eLabFTWHttpClientSpy');
    cy.get('button').contains('Retry').click();
    cy.get('@eLabFTWHttpClientSpy').should('have.been.calledWith', '/api/v2/items/1', { headers: { Authorization: 'test-read-key' }, params: {} });
  });
});
