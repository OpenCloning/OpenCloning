import React from 'react';
import PostRequestSelect from './PostRequestSelect';

describe('<PostRequestSelect />', () => {
  it('works normally', () => {
    // see: https://on.cypress.io/mounting-react
    const setValueSpy = cy.spy().as('setValueSpy');
    // Return a normal promise with a list of dummy objects with a delay of 2 seconds
    const getOptions = (query) => new Promise((resolve) => setTimeout(() => resolve([{ name: `${query}-1` }, { name: `${query}-2` }]), 2000));
    const getOptionLabel = (option) => option.name;
    const isOptionEqualToValue = (option, value) => option.name === value.name;

    cy.mount(<PostRequestSelect setValue={setValueSpy} getOptions={getOptions} getOptionLabel={getOptionLabel} isOptionEqualToValue={isOptionEqualToValue} textLabel="Test label" />);
    cy.get('input').type('dummy');
    // waiting message is shown
    cy.contains('Loading options...').should('exist');
    // wait for the options to appear
    cy.contains('dummy-1').should('exist');
    cy.contains('dummy-2').should('exist');
    // Click on the first option
    cy.contains('dummy-1').click();
    // The spy should have been called with the first option
    cy.get('@setValueSpy').should('have.been.calledWith', { name: 'dummy-1' });
  });
  it('shows an error message when the request fails', () => {
    const setValueSpy = cy.spy().as('setValueSpy');
    // Same, but 1 second delay
    const getOptions = () => new Promise((_, reject) => setTimeout(() => reject(new Error('Network error')), 1000));

    const getOptionLabel = (option) => option.name;
    const isOptionEqualToValue = (option, value) => option.name === value.name;

    cy.mount(<PostRequestSelect setValue={setValueSpy} getOptions={getOptions} getOptionLabel={getOptionLabel} isOptionEqualToValue={isOptionEqualToValue} textLabel="Test label" />);
    cy.get('input').type('dummy');
    // waiting message is shown
    cy.contains('Loading options...').should('exist');
    // wait for the error message to appear
    cy.contains('Could not retrieve data').should('exist');
    // Click on the retry button
    cy.contains('Retry').click();
    // waiting message is shown
    cy.contains('Retrying...').should('exist');
    // wait for the error message to appear
    cy.contains('Could not retrieve data').should('exist');
  });
  it('does not filter options when disableFiltering is true', () => {
    const setValueSpy = cy.spy().as('setValueSpy');
    const getOptions = (query) => new Promise((resolve) => resolve([{ name: 'AAA-1' }, { name: 'AAA-2' }]));
    const getOptionLabel = (option) => option.name;
    const isOptionEqualToValue = (option, value) => option.name === value.name;
    cy.mount(<PostRequestSelect setValue={setValueSpy} getOptions={getOptions} getOptionLabel={getOptionLabel} isOptionEqualToValue={isOptionEqualToValue} textLabel="Test label" disableFiltering />);
    cy.get('input').type('BBB');
    cy.contains('AAA-1').should('exist');
    cy.contains('AAA-2').should('exist');
    cy.get('input').clear();
    cy.get('input').type('AAA');
    cy.contains('AAA-1').should('exist');
    cy.contains('AAA-2').should('exist');

    cy.mount(<PostRequestSelect setValue={setValueSpy} getOptions={getOptions} getOptionLabel={getOptionLabel} isOptionEqualToValue={isOptionEqualToValue} textLabel="Test label" disableFiltering={false} />);
    cy.get('input').clear();
    cy.get('input').type('BBB');
    cy.contains('AAA-1').should('not.exist');
    cy.contains('AAA-2').should('not.exist');
    cy.get('input').clear();
    cy.get('input').type('AAA');
    cy.contains('AAA-1').should('exist');
    cy.contains('AAA-2').should('exist');
  });
});
