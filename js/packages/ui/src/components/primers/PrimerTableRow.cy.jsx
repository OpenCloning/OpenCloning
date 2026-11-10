import React from 'react';
import PrimerTableRow from './PrimerTableRow';
import { mockPrimerDetails, mockPCRDetails, mockPrimer } from '../../../../../tests/mockPrimerDetailsData';
import { ConfigProvider } from '../../providers/ConfigProvider';

const config = {
  backendUrl: 'http://127.0.0.1:8000',
};

describe('<PrimerTableRow />', () => {
  it('displays the right information with PCR details', () => {
    cy.mount(
      <ConfigProvider config={config}>
        <PrimerTableRow
          primerDetails={mockPrimerDetails}
          pcrDetails={mockPCRDetails}
        />
      </ConfigProvider>,
    );

    cy.get('.name').should('contain', 'Test Primer');
    cy.get('.melting-temperature').should('contain', '56.7 (60)');
    cy.get('.gc-content').should('contain', '48 (50)');
    cy.get('.length').should('contain', '21 (8)');
    cy.get('.sequence').should('contain', 'ACGTACGT');
  });
  it('displays the right information without PCR details', () => {
    cy.mount(
      <ConfigProvider config={config}>
        <PrimerTableRow
          primerDetails={mockPrimerDetails}
          pcrDetails={[]}
        />
      </ConfigProvider>,
    );
    cy.get('.melting-temperature').should('contain', '60');
    cy.get('.gc-content').should('contain', '50');
    cy.get('.length').should('contain', '8');
  });
  it('shows skeletons when info missing', () => {
    cy.mount(
      <ConfigProvider config={config}>
        <PrimerTableRow
          primerDetails={mockPrimer}
          pcrDetails={[]}
        />
      </ConfigProvider>,
    );
    cy.get('.melting-temperature .MuiSkeleton-root').should('exist');
    cy.get('.gc-content .MuiSkeleton-root').should('exist');
  });
  it('shows zero values', () => {
    // There is a handful of places where we test that values are not undefined,
    // but if we mistakenly test for bool and the value is 0, nothing will show.
    // This test is to make sure that we are testing for undefined instead of bool.
    cy.mount(
      <ConfigProvider config={config}>
        <PrimerTableRow
          primerDetails={{ ...mockPrimerDetails, melting_temperature: 0, gc_content: 0, length: 0 }}
          pcrDetails={[
            { ...mockPCRDetails[0], fwdPrimer: { ...mockPCRDetails[0].fwdPrimer, melting_temperature: 0, gc_content: 0, length: 0 } },
          ]}
        />
      </ConfigProvider>,
    );
    cy.get('.melting-temperature').should('contain', '0 (0)');
    cy.get('.gc-content').should('contain', '0 (0)');
    cy.get('.length').should('contain', '0 (0)');
  });
});
