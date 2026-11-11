import React from 'react';
import { mount } from '@cypress/react';
import PrimerInfoIcon, { PrimerInfoDialog } from './PrimerInfoIcon';
import { mockPCRDetails, mockPrimerDetails, mockPrimer } from '../../../../../../tests/mockPrimerDetailsData';

const emptyPCRDetails = [];

describe('PrimerInfoIcon Component', () => {
  it('renders the info icon when no warnings', () => {
    mount(
      <PrimerInfoIcon
        primerDetails={mockPrimerDetails}
        pcrDetails={emptyPCRDetails}
      />,
    );

    cy.get('svg[data-testid="InfoIcon"]').should('exist');
    // Mouseover shows tooltip
    cy.get('svg[data-testid="InfoIcon"]').trigger('mouseover');
    cy.get('div[role="tooltip"]').should('exist');
    cy.get('div[role="tooltip"]').should('contain', 'Primer details');
    cy.get('svg[data-testid="InfoIcon"]').click();
    cy.get('div[role="dialog"]').should('exist');
  });
  it('renders the warning icon when warnings', () => {
    mount(
      <PrimerInfoIcon
        primerDetails={{ ...mockPrimerDetails, gc_content: 0.0 }}
        pcrDetails={emptyPCRDetails}
      />,
    );

    cy.get('svg[data-testid="WarningIcon"]').should('exist');
    // Mouseover shows tooltip
    cy.get('svg[data-testid="WarningIcon"]').trigger('mouseover');
    cy.get('div[role="tooltip"]').should('exist');
    cy.get('div[role="tooltip"]').should('contain', 'GC content');
    cy.get('svg[data-testid="WarningIcon"]').click();
    cy.get('div[role="dialog"]').should('exist');
  });
  it('handles connection errors', () => {
    mount(
      <PrimerInfoIcon
        primerDetails={{ ...mockPrimer }}
        pcrDetails={emptyPCRDetails}
      />,
    );
    cy.get('span').trigger('mouseover');
    cy.get('div[role="tooltip"]').should('exist');
    cy.get('div[role="tooltip"]').should('contain', 'Primer details not available');
  });
});

describe('PrimerInfoDialog Component', () => {
  it('Without PCR details', () => {
    mount(
      <PrimerInfoDialog
        primerDetails={mockPrimerDetails}
        pcrDetails={emptyPCRDetails}
        open
        onClose={() => {}}
      />,
    );
    cy.get('div[role="dialog"]').should('exist');
    cy.get('tr').eq(0).should('contain', 'Full sequence');
    cy.get('tr').eq(1).find('td').eq(0)
      .should('contain', 'Name');
    cy.get('tr').eq(1).find('td').eq(1)
      .should('contain', 'Test Primer');

    // Full sequence section
    cy.get('tr').eq(2).find('td').eq(0)
      .should('contain', 'Length');
    cy.get('tr').eq(2).find('td').eq(1)
      .should('contain', '8');
    cy.get('tr').eq(3).find('td').eq(0)
      .should('contain', 'Tm (full sequence)');
    cy.get('tr').eq(3).find('td').eq(1)
      .should('contain', '60 °C');
    cy.get('tr').eq(4).find('td').eq(0)
      .should('contain', 'GC% (full sequence)');
    cy.get('tr').eq(4).find('td').eq(1)
      .should('contain', '50%');

    // Homodimer section
    cy.get('tr').eq(5).should('contain', 'Homodimer');
    cy.get('tr').eq(6).find('td').eq(0)
      .should('contain', 'Tm (homodimer)');
    cy.get('tr').eq(6).find('td').eq(1)
      .should('contain', '60 °C');
    cy.get('tr').eq(7).find('td').eq(0)
      .should('contain', 'ΔG (homodimer)');
    cy.get('tr').eq(7).find('td').eq(1)
      .should('contain', '-100 cal/mol');

    // Hairpin section
    cy.get('tr').eq(9).should('contain', 'Hairpin');
    cy.get('tr').eq(10).find('td').eq(0)
      .should('contain', 'Tm (hairpin)');
    cy.get('tr').eq(10).find('td').eq(1)
      .should('contain', '60 °C');
    cy.get('tr').eq(11).find('td').eq(0)
      .should('contain', 'ΔG (hairpin)');
    cy.get('tr').eq(11).find('td').eq(1)
      .should('contain', '-100 cal/mol');
    cy.get('.pcr-table').should('not.exist');
  });

  it('with PCR details', () => {
    mount(
      <PrimerInfoDialog
        primerDetails={mockPrimerDetails}
        pcrDetails={mockPCRDetails}
        open
        onClose={() => {}}
      />,
    );
    cy.get('.pcr-table').should('exist');
  });
  it('with multiple PCR details', () => {
    const mockPCRDetailsWithMultipleSources = [
      { ...mockPCRDetails[0], sourceId: 1 },
      { ...mockPCRDetails[0], sourceId: 2 },
    ];
    mount(
      <PrimerInfoDialog
        primerDetails={mockPrimerDetails}
        pcrDetails={mockPCRDetailsWithMultipleSources}
        open
        onClose={() => {}}
      />,
    );
    cy.get('.pcr-table').should('have.length', 2);
    cy.get('.pcr-table').eq(0).should('contain', 'PCR 1');
    cy.get('.pcr-table').eq(1).should('contain', 'PCR 2');
  });
});
