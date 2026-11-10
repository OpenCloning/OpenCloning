/* eslint-disable camelcase */
import React from 'react';
import OverhangsPreview from './OverhangsPreview';
import { FormDataProvider, useFormData } from '../context/FormDataContext';

function PartsInitializer({ children, initialParts = [] }) {
  const { setParts } = useFormData();
  React.useEffect(() => {
    setParts(initialParts);
  }, [initialParts, setParts]);
  return <>{children}</>;
}

function TestWrapper({ children, initialParts = [] }) {
  return (
    <FormDataProvider>
      <PartsInitializer initialParts={initialParts}>
        {children}
      </PartsInitializer>
    </FormDataProvider>
  );
}

// Minimal two-part cycle: CCCT -> AACG -> CCCT
const twoParts = [
  {
    id: 1,
    name: 'Part 1',
    info: 'First part',
    glyph: 'engineered-region',
    left_overhang: 'CCCT',
    right_overhang: 'AACG',
    left_inside: '',
    right_inside: '',
    left_codon_start: 0,
    right_codon_start: 0,
    color: '#FF0000',
  },
  {
    id: 2,
    name: 'Part 2',
    info: 'Second part',
    glyph: 'engineered-region',
    left_overhang: 'AACG',
    right_overhang: 'CCCT',
    left_inside: '',
    right_inside: '',
    left_codon_start: 0,
    right_codon_start: 0,
    color: '#00FF00',
  },
  {
    id: 3,
    name: 'Part 3',
    info: 'Briding 3 part',
    glyph: 'engineered-region',
    left_overhang: 'AACG',
    right_overhang: 'AAAA',
    left_inside: '',
    right_inside: '',
    left_codon_start: 0,
    right_codon_start: 0,
    color: '#00FF00',
  },  
  {
    id: 4,
    name: 'Part 4',
    info: 'Briding 4 part',
    glyph: 'engineered-region',
    left_overhang: 'AAAA',
    right_overhang: 'CCCT',
    left_inside: '',
    right_inside: '',
    left_codon_start: 0,
    right_codon_start: 0,
    color: '#00FF00',
  },

];

describe('<OverhangsPreview />', () => {
  it('displays a simple two-part assembly', () => {
    cy.mount(
      <TestWrapper initialParts={twoParts}>
        <OverhangsPreview />
      </TestWrapper>
    );

    cy.get('[data-testid="overhangs-preview-table"]').should('exist');
    cy.get('[data-testid="overhangs-preview-table"] tr').should('have.length', 2);
    cy.get('[data-testid="overhangs-preview-table"] tr').first().find('td').should('have.length', 3);
    cy.get('[data-testid="overhangs-preview-table"] tr').first().contains('Part 1').should('exist');
    cy.get('[data-testid="overhangs-preview-table"] tr').first().contains('Part 3').should('exist');
    cy.get('[data-testid="overhangs-preview-table"] tr').first().contains('Part 4').should('exist');
    cy.get('[data-testid="overhangs-preview-table"] tr').first().contains('First part').should('exist');
    cy.get('[data-testid="overhangs-preview-table"] tr').first().contains('Briding 3 part').should('exist');
    cy.get('[data-testid="overhangs-preview-table"] tr').first().contains('Briding 4 part').should('exist');

    cy.get('[data-testid="overhangs-preview-table"] tr').eq(1).find('td').should('have.length', 2);
    cy.get('[data-testid="overhangs-preview-table"] tr').eq(1).find('td').eq(0).contains('Part 1').should('exist');
    cy.get('[data-testid="overhangs-preview-table"] tr').eq(1).find('td').eq(1).contains('Part 2').should('exist');
    cy.get('[data-testid="overhangs-preview-table"] tr').eq(1).contains('First part').should('exist');
    cy.get('[data-testid="overhangs-preview-table"] tr').eq(1).contains('Second part').should('exist');


    // Switch to compact mode
    cy.get('label').contains('Detailed').click({ force: true });
    cy.get('[data-testid="overhangs-preview-table"] tr').should('have.length', 2);
    cy.get('[data-testid="overhangs-preview-table"] tr').first().find('td').should('have.length', 7);
    cy.get('[data-testid="overhangs-preview-table"] tr').eq(1).find('td').should('have.length', 5);
    cy.contains('Part 1').should('not.exist');
  });
});
