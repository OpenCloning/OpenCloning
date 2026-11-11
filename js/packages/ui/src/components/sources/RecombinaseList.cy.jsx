import React from 'react';
import RecombinaseList from './RecombinaseList';
import { clearInputValue, setInputValue } from '../../../../../cypress/e2e/common_functions';

const initialRecombinases = [
  { site1: 'AAaaTTC', site2: 'CCaaGC', site1_name: 'attB', site2_name: 'attP' },
];

const twoRecombinases = [
  ...initialRecombinases,
  { site1: 'ATGCCCTAAaaCT', site2: 'CAaaTTTTTTTCCCT', site1_name: 'attB', site2_name: 'attP' },
];

describe('<RecombinaseList />', () => {
  it('enforces site pattern constraints and does not add invalid sites', () => {
    const setRecombinasesSpy = cy.spy().as('setRecombinasesSpy');
    cy.mount(<RecombinaseList recombinases={[]} setRecombinases={setRecombinasesSpy} />);

    // Invalid: all uppercase (no lowercase region)
    setInputValue('Site 1', 'AAAA', 'body');
    setInputValue('Site 2', 'CCaaGC', 'body');
    cy.get('button').contains('Add recombinase').click();
    cy.get('@setRecombinasesSpy').should('not.have.been.called');
    cy.contains('Sites must match').should('exist');

    // Invalid: all lowercase
    setInputValue('Site 1', 'aaaa', 'body');
    setInputValue('Site 2', 'CCaaGC', 'body');
    cy.get('button').contains('Add recombinase').click();
    cy.get('@setRecombinasesSpy').should('not.have.been.called');

    // Invalid: empty site
    clearInputValue('Site 1', 'body');
    setInputValue('Site 2', 'CCaaGC', 'body');
    cy.get('button').contains('Add recombinase').click();
    cy.get('@setRecombinasesSpy').should('not.have.been.called');
    cy.contains('Required').should('exist');

    // Valid: add with correct pattern
    setInputValue('Site 1', 'AAaaTTC', 'body');
    setInputValue('Site 2', 'CCaaGC', 'body');
    cy.get('button').contains('Add recombinase').click();
    cy.get('@setRecombinasesSpy').should('have.been.calledOnce');
    cy.get('@setRecombinasesSpy').should('have.been.calledWith', [{
      site1: 'AAaaTTC',
      site2: 'CCaaGC',
      site1_name: 'attB',
      site2_name: 'attP',
    }]);
  });

  it('displays initial recombinases and appends when adding (does not overwrite)', () => {
    const setRecombinasesSpy = cy.spy().as('setRecombinasesSpy');
    cy.mount(
      <RecombinaseList recombinases={initialRecombinases} setRecombinases={setRecombinasesSpy} />
    );

    cy.get('.MuiChip-root').should('have.length', 1);
    cy.get('.MuiChip-root').contains('AAaaTTC');

    setInputValue('Site 1', 'ATGCCCTAAaaCT', 'body');
    setInputValue('Site 2', 'CAaaTTTTTTTCCCT', 'body');
    cy.get('button').contains('Add recombinase').click();

    cy.get('@setRecombinasesSpy').should('have.been.calledWith', [
      { site1: 'AAaaTTC', site2: 'CCaaGC', site1_name: 'attB', site2_name: 'attP' },
      { site1: 'ATGCCCTAAaaCT', site2: 'CAaaTTTTTTTCCCT', site1_name: 'attB', site2_name: 'attP' },
    ]);
  });

  it('calls setRecombinases with filtered array when deleting a chip', () => {
    const setRecombinasesSpy = cy.spy().as('setRecombinasesSpy');
    cy.mount(
      <RecombinaseList recombinases={twoRecombinases} setRecombinases={setRecombinasesSpy} />
    );

    cy.get('.MuiChip-root').should('have.length', 2);
    cy.get('.MuiChip-root').first().find('.MuiChip-deleteIcon').click();
    cy.get('@setRecombinasesSpy').should('have.been.calledWith', [
      { site1: 'ATGCCCTAAaaCT', site2: 'CAaaTTTTTTTCCCT', site1_name: 'attB', site2_name: 'attP' },
    ]);
  });

  it('includes optional name and custom site names when provided', () => {
    const setRecombinasesSpy = cy.spy().as('setRecombinasesSpy');
    cy.mount(<RecombinaseList recombinases={[]} setRecombinases={setRecombinasesSpy} />);

    setInputValue('Recombinase name (optional)', 'MyRecombinase', 'body');
    setInputValue('Site 1', 'AAaaTTC', 'body');
    setInputValue('Site 1 name', 'loxP', 'body');
    setInputValue('Site 2', 'CCaaGC', 'body');
    setInputValue('Site 2 name', 'loxR', 'body');
    cy.get('button').contains('Add recombinase').click();

    cy.get('@setRecombinasesSpy').should('have.been.calledWith', [{
      name: 'MyRecombinase',
      site1: 'AAaaTTC',
      site2: 'CCaaGC',
      site1_name: 'loxP',
      site2_name: 'loxR',
    }]);
  });
});
