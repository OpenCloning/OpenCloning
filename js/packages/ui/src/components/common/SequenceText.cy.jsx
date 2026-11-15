import React from 'react';
import { Table, TableBody, TableCell, TableRow, TextField } from '@mui/material';
import SequenceText, { sequenceInputSx } from './SequenceText';

const isMonospace = ($el) => expect(getComputedStyle($el[0]).fontFamily).to.equal('monospace');

describe('<SequenceText />', () => {
  it('renders an inline monospace span at the size of the surrounding text', () => {
    cy.mount(<div style={{ fontSize: '20px' }}>Site: <SequenceText data-testid="seq">ACGT</SequenceText></div>);
    cy.get('[data-testid="seq"]').should(($el) => {
      expect($el[0].tagName).to.equal('SPAN');
      isMonospace($el);
      expect(getComputedStyle($el[0]).fontSize).to.equal('20px');
    });
  });

  it('sequenceInputSx makes the input of a TextField monospace', () => {
    cy.mount(<TextField label="Sequence" defaultValue="ACGT" sx={sequenceInputSx} />);
    cy.get('input').should(isMonospace);
    cy.get('label').should(($el) => expect(getComputedStyle($el[0]).fontFamily).not.to.equal('monospace'));
  });

  it('typography: sequence in sx only changes the font of a table cell', () => {
    cy.mount(
      <Table>
        <TableBody>
          <TableRow>
            <TableCell data-testid="plain">name</TableCell>
            <TableCell data-testid="seq" sx={{ typography: 'sequence' }}>ACGT</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );
    cy.get('[data-testid="seq"]').should(isMonospace);
    cy.get('[data-testid="plain"]').then(($plain) => {
      cy.get('[data-testid="seq"]').should(($seq) => {
        expect(getComputedStyle($seq[0]).fontSize).to.equal(getComputedStyle($plain[0]).fontSize);
      });
    });
  });
});
