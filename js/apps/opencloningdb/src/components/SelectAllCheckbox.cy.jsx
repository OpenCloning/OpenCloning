import React from 'react';
import SelectAllCheckbox from './SelectAllCheckbox';

describe('<SelectAllCheckbox />', () => {
  it('is disabled when there are no ids to toggle', () => {
    cy.mount(<SelectAllCheckbox ids={[]} selectedIds={new Set()} toggleRow={cy.spy()} />);

    cy.get('input[aria-label="select all"]').should('be.disabled');
  });

  it('shows an indeterminate state when some but not all rows are selected', () => {
    cy.mount(
      <SelectAllCheckbox
        ids={[1, 2, 3]}
        selectedIds={new Set([2])}
        toggleRow={cy.spy()}
      />,
    );

    cy.get('input[aria-label="select all"]')
      .should('not.be.checked')
      .and('have.attr', 'data-indeterminate', 'true');
  });

  it('toggles only the missing ids when not all rows are selected', () => {
    const toggleRow = cy.spy().as('toggleRow');

    cy.mount(
      <SelectAllCheckbox
        ids={[1, 2, 3]}
        selectedIds={new Set([2])}
        toggleRow={toggleRow}
      />,
    );

    cy.get('input[aria-label="select all"]').click({ force: true });

    cy.get('@toggleRow').should('have.callCount', 2);
    cy.get('@toggleRow').its('firstCall.args.0').should('equal', 1);
    cy.get('@toggleRow').its('secondCall.args.0').should('equal', 3);
  });

  it('toggles every selected id when all rows are selected', () => {
    const toggleRow = cy.spy().as('toggleRow');

    cy.mount(
      <SelectAllCheckbox
        ids={[1, 2, 3]}
        selectedIds={new Set([1, 2, 3])}
        toggleRow={toggleRow}
      />,
    );

    cy.get('input[aria-label="select all"]')
      .should('be.checked')
      .and('have.attr', 'data-indeterminate', 'false')
      .click({ force: true });

    cy.get('@toggleRow').should('have.callCount', 3);
    cy.get('@toggleRow').its('firstCall.args.0').should('equal', 1);
    cy.get('@toggleRow').its('secondCall.args.0').should('equal', 2);
    cy.get('@toggleRow').its('thirdCall.args.0').should('equal', 3);
  });
});
