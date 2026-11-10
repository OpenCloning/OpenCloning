import React from 'react';
import EnzymeMultiSelect from './EnzymeMultiSelect';
import { ConfigProvider } from '@opencloning/ui/providers/ConfigProvider';

const config = {
  backendUrl: 'http://127.0.0.1:8000',
};

describe('<EnzymeMultiSelect />', () => {
  it('can add and remove enzymes, sets enzymes', () => {
    // see: https://on.cypress.io/mounting-react
    const setEnzymesSpy = cy.spy().as('setEnzymesSpy');
    cy.mount(
      <ConfigProvider config={config}>
        <EnzymeMultiSelect setEnzymes={setEnzymesSpy} />
      </ConfigProvider>
    );
    cy.get('.MuiInputBase-root').click();
    // All enzymes shown
    cy.get('div[role="presentation"]', { timeout: 20000 }).contains('AanI');
    // Type EcoRI
    cy.get('label').contains('Enzymes used').siblings('div').children('input')
      .type('EcoRI');
    cy.get('div[role="presentation"]').contains('AanI').should('not.exist');
    cy.get('div[role="presentation"]').contains('EcoRI');
    // Select the option
    cy.get('div[role="presentation"]').contains('EcoRI').click();
    cy.get('@setEnzymesSpy').should('have.been.calledWith', ['EcoRI']);
    // Select SalI
    cy.get('label').contains('Enzymes used').siblings('div').children('input')
      .clear('');
    cy.get('label').contains('Enzymes used').siblings('div').children('input')
      .type('SalI');
    cy.get('div[role="presentation"]').contains('SalI').click();
    cy.get('@setEnzymesSpy').should('have.been.calledWith', ['EcoRI', 'SalI']);
    // There should be two chips
    cy.get('.MuiChip-root').contains('EcoRI');
    cy.get('.MuiChip-root').contains('SalI');
    // We can remove SalI
    cy.get('.MuiChip-root').contains('SalI').siblings('svg').click();
    cy.get('.MuiChip-root').contains('SalI').should('not.exist');
    cy.get('.MuiChip-root').contains('EcoRI');
    // We can remove EcoRI
    cy.get('.MuiChip-root').contains('EcoRI').siblings('svg').click();
    cy.get('.MuiChip-root').should('not.exist');
  });
  it('shows error message when server is down', () => {
    cy.intercept('GET', '/restriction_enzyme_list', {
      statusCode: 500,
      body: 'Server down',
    });
    cy.mount(
      <ConfigProvider config={config}>
        <EnzymeMultiSelect setEnzymes={() => {}} />
      </ConfigProvider>
    );
    cy.get('.MuiAlert-message').contains('Could not retrieve enzymes from server');
  });
  it('shows loading message', () => {
    cy.intercept('GET', '/restriction_enzyme_list', {
      delayMs: 1000,
      body: { enzyme_names: ['EcoRI', 'SalI'] },
    });
    cy.mount(
      <ConfigProvider config={config}>
        <EnzymeMultiSelect setEnzymes={() => {}} />
      </ConfigProvider>
    );
    cy.get('.MuiCircularProgress-svg');
    cy.contains('retrieving enzymes...').should('exist');
  });
});
