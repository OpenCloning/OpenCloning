import React from 'react';
import { mount } from '@cypress/react';
import PCRTable from './PCRTable';
import { mockPCRDetails } from '../../../../../../tests/mockPrimerDetailsData';

describe('PCRTable', () => {
  it('renders PCR details correctly', () => {
    mount(<PCRTable pcrDetail={mockPCRDetails[0]} />);
    // PCR 3 Section Header
    cy.get('.pcr-table tr').eq(0).should('contain', 'PCR 3');

    // Primer Names Row
    cy.contains('.pcr-table tr', 'Primer names').within(() => {
      cy.get('td').eq(1).should('contain', 'fwd');
      cy.get('td').eq(2).should('contain', 'rvs');
    });

    // Binding Information
    cy.contains('.pcr-table tr', 'Binding length').within(() => {
      cy.get('td').eq(1).should('contain', '21');
      cy.get('td').eq(2).should('contain', '20');
    });

    cy.contains('.pcr-table tr', 'Tm (binding)').within(() => {
      cy.get('td').eq(1).should('contain', '56.7 °C');
      cy.get('td').eq(2).should('contain', '50.9 °C');
    });

    cy.contains('.pcr-table tr', 'GC% (binding)').within(() => {
      cy.get('td').eq(1).should('contain', '48%');
      cy.get('td').eq(2).should('contain', '40%');
    });

    // Temperature Difference
    cy.contains('.pcr-table tr', 'Tm difference').within(() => {
      cy.get('td').should('contain', '5.8 °C');
    });

    // Heterodimer Information
    cy.contains('.pcr-table tr', 'Tm (heterodimer)').within(() => {
      cy.get('td').should('contain', '20.5 °C');
    });

    cy.contains('.pcr-table tr', 'ΔG (heterodimer)').within(() => {
      cy.get('td').should('contain', '-5276 cal/mol');
    });

    // Verify heterodimer figure exists
    cy.contains('SEQ').should('exist');
  });
});
