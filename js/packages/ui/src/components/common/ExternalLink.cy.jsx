import React from 'react';
import ExternalLink from './ExternalLink';

describe('<ExternalLink />', () => {
  it('opens in a new tab without access to the opener', () => {
    cy.mount(<ExternalLink href="https://example.com">Example</ExternalLink>);
    cy.get('a[href="https://example.com"]')
      .should('have.attr', 'target', '_blank')
      .and('have.attr', 'rel', 'noopener noreferrer')
      .and('contain', 'Example');
  });

  it('passes other props to the MUI Link', () => {
    cy.mount(<ExternalLink href="https://example.com" underline="none" className="my-link">Example</ExternalLink>);
    cy.get('a.my-link').should('have.class', 'MuiLink-underlineNone');
  });
});
